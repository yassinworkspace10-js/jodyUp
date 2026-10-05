const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const dns = require("dns");
const cookieParser = require("cookie-parser");
const httpStatusText = require("./utils/httpStatusText");

const isProduction = process.env.NODE_ENV === "production";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const requiredEnvVars = ["PORT", "MONGO_DB_URI", "JWT_SECRET_KEY"];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnvVars.join(", ")}. Check your .env file.`);
  process.exit(1);
}
if ((process.env.JWT_SECRET_KEY || "").length < 32) {
  console.error("JWT_SECRET_KEY is too short — use at least 32 random characters.");
  process.exit(1);
}
if (!isProduction) {
  console.warn("NODE_ENV is not 'production' — set NODE_ENV=production on the live server (secure cookies, no debug output).");
}
if (isProduction && !process.env.SITE_URL) {
  console.warn("SITE_URL is not set — canonical links/sitemap will use the request's Host header. Set SITE_URL=https://yourdomain.com");
}

const SITE_URL = (process.env.SITE_URL || "").replace(/\/+$/, "");

const app = express();

// The host sits behind a reverse proxy — needed for correct protocol/IP detection,
// secure cookies and rate limiting. If everyone appears to share one IP on your host
// (rate limiter blocking all visitors together), raise TRUST_PROXY.
app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));
app.disable("x-powered-by");
app.set("etag", "strong");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
if (isProduction) app.enable("view cache");

// Per-request nonce: lets our own inline <script> blocks run while any injected script is blocked.
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);
app.use(compression());

// The site and admin panel are same-origin. Cross-origin API access is OFF unless you
// list the allowed origins in CORS_ORIGIN (comma separated).
if (process.env.CORS_ORIGIN) {
  app.use("/api", cors({ origin: process.env.CORS_ORIGIN.split(",").map((s) => s.trim()) }));
}

app.use(express.json({ limit: "100kb" }));
// extended:false => no nested objects in form bodies (blocks NoSQL operator injection like email[$ne]=x)
app.use(express.urlencoded({ extended: false, limit: "300kb" }));
app.use(cookieParser());

app.get("/healthz", (req, res) => {
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).json({ ok });
});

const staticOptions = { maxAge: isProduction ? "1d" : 0, etag: true, index: false, dotfiles: "ignore" };
app.use(express.static(path.join(__dirname, "public"), staticOptions));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), { ...staticOptions, maxAge: isProduction ? "30d" : 0 })); // legacy local images only

// ---- Product photos stored in MongoDB -------------------------------------------------
// /img/<id>.webp (full) and /img/<id>_s.webp (thumbnail). IDs never change, so browsers
// cache them for a year and a repeat visit never touches the database (304 straight away).
const Image = require("./models/Image");
const imageCache = require("./utils/imageCache");
const { makeThumb } = require("./utils/imageProcessing");
const pendingThumbs = new Map();

app.get("/img/:file", async (req, res) => {
  const m = /^([a-f0-9]{24})(_s)?\.webp$/.exec(req.params.file);
  if (!m) return res.sendStatus(404);
  const [, id, thumbFlag] = m;
  const key = thumbFlag ? `${id}_s` : id;
  const etag = `"${key}"`;

  res.set({ "Cache-Control": "public, max-age=31536000, immutable", ETag: etag, "Content-Type": "image/webp" });
  if (req.get("if-none-match") === etag) return res.status(304).end();

  const hit = imageCache.get(key);
  if (hit) return res.send(hit);

  try {
    const img = await Image.findById(id).select("data thumb contentType");
    if (!img) {
      res.set("Cache-Control", "no-store");
      return res.sendStatus(404);
    }
    let buffer = Buffer.from(img.data);
    if (thumbFlag) {
      if (img.thumb && img.thumb.length) {
        buffer = Buffer.from(img.thumb);
      } else {
        // photo uploaded before thumbnails existed: build it once, save it, reuse forever
        if (!pendingThumbs.has(id)) {
          pendingThumbs.set(
            id,
            makeThumb(buffer)
              .then(async (thumb) => {
                await Image.updateOne({ _id: id }, { $set: { thumb } });
                return thumb;
              })
              .catch(() => buffer)
              .finally(() => pendingThumbs.delete(id))
          );
        }
        buffer = await pendingThumbs.get(id);
      }
    }
    imageCache.set(key, buffer);
    res.send(buffer);
  } catch (err) {
    res.set("Cache-Control", "no-store");
    res.sendStatus(500);
  }
});

// ---- General rate limit for everything dynamic (static files & photos are exempt) -----
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests. Please slow down.",
  })
);

// Brute-force protection: only FAILED login attempts count.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: httpStatusText.FAIL, message: "Too many login attempts. Please try again later." },
});
app.post("/admin/login", loginLimiter);
app.post("/api/auth/login", loginLimiter);

const socialLinks = require("./config/socialLinks");
const { dictionaries, formatPrice } = require("./utils/i18n");
const Category = require("./models/Category");
const Settings = require("./models/Settings");
const { SIZES } = require("./models/Product");
const siteCache = require("./utils/siteCache");

// JSON that is safe to print inside a <script> tag: a "</script>" (or an
// HTML comment) inside a product name/description can't break out of it.
function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

app.use((req, res, next) => {
  res.locals.safeJson = safeJson;
  res.locals.thumb = Image.thumbUrl;
  res.locals.siteUrl = SITE_URL || `${req.protocol}://${req.get("host")}`;
  res.locals.currentUrl = res.locals.siteUrl + req.originalUrl;
  res.locals.robots = "index, follow";
  next();
});

// Settings + categories are needed on every page but rarely change: cached for 30s
// (and cleared instantly when the admin saves changes).
function loadSiteData() {
  return siteCache.cached("site", 30 * 1000, async () => {
    const [settings, categories] = await Promise.all([
      Settings.getSingleton().then((s) => s.toObject()),
      Category.listOrSeed().then((list) => list.map((c) => c.toObject())),
    ]);
    return { settings, categories };
  });
}

app.use(async (req, res, next) => {
  const isArabic = req.path === "/ar" || req.path.startsWith("/ar/");
  const locale = isArabic ? "ar" : "en";
  res.locals.locale = locale;
  res.locals.prefix = isArabic ? "/ar" : "";

  if (req.path.startsWith("/api")) {
    res.locals.t = dictionaries[locale];
    return next();
  }

  let settings = null;
  let categories = [];
  try {
    ({ settings, categories } = await loadSiteData());
  } catch (err) {
    console.error("Failed to load site settings/categories:", err.message);
  }

  const d = dictionaries[locale];
  res.locals.t = settings
    ? {
        ...d,
        tagline: settings.tagline[locale],
        metaDescription: settings.metaDescription[locale],
        hero_title: settings.hero.title[locale],
        hero_subtitle: settings.hero.subtitle[locale],
        hero_cta: settings.hero.cta[locale],
        about_title: settings.about.title[locale],
        about_body: settings.about.body[locale],
      }
    : d;

  res.locals.socialLinks = settings ? settings.socialLinks : socialLinks;
  const activeWhatsapp = settings
    ? settings.whatsappNumbers.filter((n) => n.active && n.number)
    : process.env.WHATSAPP_NUMBER
    ? [{ label: "", number: process.env.WHATSAPP_NUMBER }]
    : [];
  res.locals.whatsappNumbers = activeWhatsapp.map((n) => ({ label: n.label, number: String(n.number).replace(/[^\d]/g, "") }));
  res.locals.contactNumbers = settings ? settings.contactNumbers.filter((n) => n.active && n.number) : [];
  res.locals.footer = settings
    ? { email: settings.footer.email, rightsText: settings.footer.rightsText[locale] }
    : { email: "goudywomenswear@gmail.com", rightsText: locale === "ar" ? "مكتب جودي. جميع الحقوق محفوظة." : "Jody Office. All rights reserved." };
  res.locals.navCategories = categories.map((c) => c.key);

  const categoryLabelMap = {};
  categories.forEach((c) => {
    categoryLabelMap[c.key] = c.label;
  });
  res.locals.categoryLabel = (cat) => (categoryLabelMap[cat] ? categoryLabelMap[cat][locale] : cat);
  res.locals.formatPrice = (product) => formatPrice(product, locale);

  const sizeLabelMap = {};
  SIZES.forEach((s) => {
    sizeLabelMap[s.key] = s[locale];
  });
  res.locals.sizeLabel = (size) => sizeLabelMap[size] || size;

  const bareRestPath = isArabic ? req.path.slice(3) || "/" : req.path;
  res.locals.altLocale = isArabic ? "en" : "ar";
  res.locals.altPath = isArabic ? bareRestPath || "/" : `/ar${bareRestPath}`;
  next();
});

mongoose
  .connect(process.env.MONGO_DB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 10000 })
  .then(() => console.log("connected to MongoDB"))
  .catch((err) => console.log("MongoDB connection error:", err.message));

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/products", require("./routes/product.routes"));
app.use("/admin", require("./routes/admin.routes"));
app.use(require("./routes/sitemap.routes"));

const webRoutes = require("./routes/web.routes");
app.use("/ar", webRoutes);
app.use("/", webRoutes);

app.use((req, res) => {
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({
      status: httpStatusText.ERROR,
      message: "Page not found",
    });
  }
  res.status(404).render("404", { title: res.locals.t.page_not_found });
});

app.use((err, req, res, next) => {
  if (!isProduction) console.error(err);
  else if (!err.statusCode || err.statusCode >= 500) console.error(err.message);

  if (err.type === "entity.too.large") err.statusCode = 413;

  if (req.originalUrl.startsWith("/api")) {
    return res.status(err.statusCode || 500).json({
      status: err.statusText || httpStatusText.ERROR,
      message: err.statusCode ? err.message : "Something went wrong. Please try again.",
    });
  }
  res.status(err.statusCode || 500).render("404", {
    title: res.locals.t ? res.locals.t.page_not_found : "Error",
    message: err.message && err.statusCode ? err.message : "Please try again in a moment.",
  });
});

mongoose.connection.on("error", (err) => console.error("MongoDB connection error:", err.message));

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

const server = app.listen(process.env.PORT, () => {
  console.log(`Jody Office app listening on port ${process.env.PORT} (${isProduction ? "production" : "development"})`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully.");
  server.close(() => mongoose.connection.close(false).then(() => process.exit(0)));
});

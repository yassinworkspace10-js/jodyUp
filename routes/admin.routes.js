const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const validator = require("validator");

const Product = require("../models/Product");
const { slugify, MAX_SLIDER_IMAGES, SIZES, LOW_STOCK_THRESHOLD } = Product;
const MainProduct = require("../models/MainProduct");
const Category = require("../models/Category");
const Settings = require("../models/Settings");
const User = require("../models/User");
const Image = require("../models/Image");
const userRoles = require("../utils/roles");
const generateJWT = require("../utils/generateJWT");
const webAuth = require("../middlewares/webAuth");
const upload = require("../middlewares/uploadImages");
const sameOrigin = require("../middlewares/sameOrigin");
const siteCache = require("../utils/siteCache");
const { CARD_PROJECTION } = Product;

const uploadCsv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 5 } });

// Only local photo URLs can be attached to a product (blocks arbitrary strings smuggled into the form).
const SAFE_IMAGE_URL = /^\/(img\/[a-f0-9]{24}\.webp|uploads\/[\w.\-]+)$/;
const DELETE_ALL_PHRASE = "DELETE ALL";
const MAX_CSV_ROWS = 20000;
const PAGE_SIZE = 50;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// dummy hash so a wrong email takes as long to reject as a wrong password (no account enumeration by timing)
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

// Only http(s) links may be saved as social links (blocks javascript: URLs).
function safeUrl(value) {
  const url = String(value || "").trim();
  return validator.isURL(url, { protocols: ["http", "https"], require_protocol: true }) ? url : "";
}

// Excel/Soft Magic exports use a comma, a semicolon (common with Arabic
// regional settings) or a tab between columns — accept all three.
function splitCsvLine(line) {
  const delimiter = line.includes("\t") ? "\t" : line.includes(";") && !line.includes(",") ? ";" : ",";
  return line.split(delimiter).map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim());
}

function parseStockCsv(buffer) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = [];
  lines.forEach((line) => {
    const cols = splitCsvLine(line);
    const modelNumber = cols[0];
    // An empty quantity cell must NOT count as 0 (Number("") === 0) — that
    // would silently mark the product out of stock.
    if (!modelNumber || cols[1] === undefined || cols[1] === "") return;
    const quantity = Number(cols[1]);
    if (!Number.isFinite(quantity)) return; // header row / junk
    rows.push({ modelNumber, stockQuantity: Math.max(0, Math.round(quantity)) });
  });
  return rows;
}

function parseList(value) {
  return value ? String(value).split(",").map((v) => v.trim()).filter((v) => SAFE_IMAGE_URL.test(v)) : [];
}

function parseSizes(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.filter((s) => SIZES.some((size) => size.key === s));
}

function buildColors(body, files) {
  const indices = new Set();
  Object.keys(body).forEach((k) => {
    const m = k.match(/^colorName_(\d+)$/);
    if (m) indices.add(m[1]);
  });
  files.forEach((f) => {
    const m = f.fieldname.match(/^colorImages_(\d+)$/);
    if (m) indices.add(m[1]);
  });

  const colors = [];
  indices.forEach((i) => {
    const name = (body[`colorName_${i}`] || "").trim();
    const uploaded = files
      .filter((f) => f.fieldname === `colorImages_${i}`)
      .map((f) => f.url);
    const images = uploaded.length ? uploaded : parseList(body[`colorExisting_${i}`]);
    if (name && images.length) colors.push({ name, images });
  });
  return colors;
}

function productPayload(body, files) {
  return {
    name: { en: body.nameEn, ar: body.nameAr },
    description: { en: body.descriptionEn, ar: body.descriptionAr },
    priceEGP: body.priceEGP,
    modelNumber: body.modelNumber || undefined,
    category: body.category,
    sizes: parseSizes(body.sizes),
    colors: buildColors(body, files || []),
    inStock: body.inStock === "on",

    stockQuantity: body.stockQuantity !== undefined && body.stockQuantity !== "" ? Number(body.stockQuantity) : null,
    featured: body.featured === "on",
    showInSlider: body.showInSlider === "on",
  };
}

async function sliderIsFull(excludeId) {
  const query = { showInSlider: true };
  if (excludeId) query._id = { $ne: excludeId };
  const count = await Product.countDocuments(query);
  return count >= MAX_SLIDER_IMAGES;
}

function uploadErrorMessage(err) {
  if (err.code === "LIMIT_FILE_SIZE") return "One of the images is larger than 5 MB. Please choose a smaller photo.";
  return err.message || "There was a problem uploading the images. Please try again.";
}

function handleUpload(req, res, next) {
  upload.any()(req, res, (err) => {
    if (err) {
      req.uploadError = uploadErrorMessage(err);
    }
    next();
  });
}

function handleCsvUpload(req, res, next) {
  uploadCsv.single("csvFile")(req, res, (err) => {
    if (err) {
      req.uploadError = err.code === "LIMIT_FILE_SIZE" ? "That file is larger than 2 MB." : err.message;
    }
    next();
  });
}

router.use(sameOrigin); // CSRF protection for every POST in the admin panel
router.use((req, res, next) => {
  res.header("Cache-Control", "no-store"); // admin pages are never cached by the browser/proxies
  res.locals.robots = "noindex, nofollow";
  res.locals.sizeOptions = SIZES;
  next();
});

router.get("/login", (req, res) => {
  res.render("admin/login", { title: "Admin Login — Jody Office", error: req.query.error || null });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = email && password ? await User.findOne({ email: String(email).trim().toLowerCase() }) : null;
  const passwordOk = await bcrypt.compare(String(password || ""), user ? user.password : DUMMY_HASH);
  const matched = Boolean(user) && passwordOk;

  if (!matched) {
    return res.redirect("/admin/login?error=Invalid email or password");
  }

  const token = await generateJWT({ email: user.email, id: user._id, role: user.role });

  res.cookie("token", token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.redirect("/admin");
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/admin/login");
});

router.use(webAuth);

// Only ADMIN accounts can manage other admin/staff accounts.
function requireAdmin(req, res, next) {
  if (req.verfiy.role !== userRoles.ADMIN) {
    return res.status(403).render("404", { title: "Not allowed", message: "Only admins can do that." });
  }
  next();
}

router.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  const requestedPage = Number.parseInt(req.query.page, 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ "name.en": rx }, { "name.ar": rx }, { modelNumber: rx }];
  }

  // Counts and small lists are computed by the database — the page never loads every product.
  const [products, filteredTotal, total, inStockCount, featuredCount, outOfStockCount, mostViewed, lowStock, categories] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).select(CARD_PROJECTION).lean(),
    Product.countDocuments(filter),
    Product.countDocuments(),
    Product.countDocuments({ inStock: true }),
    Product.countDocuments({ featured: true }),
    Product.countDocuments({ inStock: false }),
    Product.find({ views: { $gt: 0 } }).sort({ views: -1 }).limit(5).select("name views").lean(),
    Product.find({ inStock: true, stockQuantity: { $lte: LOW_STOCK_THRESHOLD } }).sort({ stockQuantity: 1 }).limit(50).select("name stockQuantity").lean(),
    Category.listOrSeed(),
  ]);
  const categoryLabels = {};
  categories.forEach((c) => {
    categoryLabels[c.key] = c.label.en;
  });

  res.render("admin/dashboard", {
    title: "Dashboard — Jody Office Admin",
    products,
    stats: { total, inStock: inStockCount, featured: featuredCount, outOfStock: outOfStockCount },
    categoryLabels,
    mostViewed,
    lowStock,
    outOfStockCount,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    q,
    page: Math.min(page, Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE))),
    totalPages: Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE)),
    filteredTotal,
    notice: req.query.notice || null,
    error: req.query.error || null,
  });
});

router.get("/users", requireAdmin, async (req, res) => {
  const users = await User.find().sort({ createdAt: 1 });
  res.render("admin/users", {
    title: "Users — Jody Office Admin",
    users,
    roles: Object.values(userRoles),
    notice: req.query.notice || null,
    error: req.query.error || null,
  });
});

router.post("/users", requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.redirect("/admin/users?error=Name, email and password are required");
  }
  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
    return res.redirect("/admin/users?error=Invalid input");
  }
  if (!validator.isEmail(email.trim())) {
    return res.redirect("/admin/users?error=Please enter a valid email address");
  }
  if (password.length < 8 || password.length > 72) {
    return res.redirect("/admin/users?error=Password must be 8 to 72 characters");
  }

  try {
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.redirect("/admin/users?error=That email is already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: Object.values(userRoles).includes(role) ? role : userRoles.USER,
    });
    res.redirect("/admin/users?notice=User added");
  } catch (err) {
    res.redirect(`/admin/users?error=${encodeURIComponent(err.message)}`);
  }
});

router.post("/users/:id/delete", requireAdmin, async (req, res) => {
  if (req.params.id === req.verfiy.id) {
    return res.redirect("/admin/users?error=You can't delete your own account while logged in as it");
  }

  const target = await User.findById(req.params.id);
  if (!target) {
    return res.redirect("/admin/users?error=User not found");
  }

  if (target.role === userRoles.ADMIN) {
    const adminCount = await User.countDocuments({ role: userRoles.ADMIN });
    if (adminCount <= 1) {
      return res.redirect("/admin/users?error=Can't delete the last remaining admin account");
    }
  }

  await User.findByIdAndDelete(req.params.id);
  res.redirect("/admin/users?notice=User removed");
});

// The imported mainProducts stock list (~2,000 items), used to populate the
// "fill from stock list" dropdown on the New Product form.
async function loadMainProducts() {
  // ~2,000 rows read on every "New product" page — cached for 5 minutes.
  return siteCache.cached("main-products", 5 * 60 * 1000, loadMainProductsFromDb);
}
async function loadMainProductsFromDb() {
  const items = await MainProduct.find().sort({ name: 1 }).select("knum name price available balance").lean();
  return items.map((i) => ({
    id: String(i._id),
    knum: i.knum || "",
    name: i.name || "",
    price: typeof i.price === "number" ? i.price : Number(i.price) || 0,
    available: !!i.available,
    balance: typeof i.balance === "number" ? i.balance : Number(i.balance) || 0,
  }));
}

router.get("/products/new", async (req, res) => {
  const [sliderCount, categories, mainProducts] = await Promise.all([
    Product.countDocuments({ showInSlider: true }),
    Category.listOrSeed(),
    loadMainProducts(),
  ]);
  res.render("admin/productForm", {
    title: "New Product — Jody Office Admin",
    categories,
    product: null,
    values: null,
    error: null,
    sliderCount,
    maxSliderImages: MAX_SLIDER_IMAGES,
    mainProducts,
  });
});

// ---- Delete ALL products (admin only, two-step, password protected) ------------------
// Defined before the "/products/:id" routes so "delete-all" is never read as a product id.
const deleteAllLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: "Too many attempts. Try again later." });

async function renderDeleteAll(res, status, error) {
  const total = await Product.countDocuments();
  res.status(status).render("admin/deleteAll", {
    title: "Delete all products — Jody Office Admin",
    total,
    phrase: DELETE_ALL_PHRASE,
    error: error || null,
  });
}

router.get("/products/delete-all", requireAdmin, (req, res) => renderDeleteAll(res, 200));

router.post("/products/delete-all", requireAdmin, deleteAllLimiter, async (req, res) => {
  const { confirmText, password } = req.body || {};
  if (confirmText !== DELETE_ALL_PHRASE) {
    return renderDeleteAll(res, 400, `Type exactly ${DELETE_ALL_PHRASE} to confirm.`);
  }
  const user = await User.findById(req.verfiy.id);
  if (!user || typeof password !== "string" || !(await bcrypt.compare(password, user.password))) {
    return renderDeleteAll(res, 400, "Wrong password. Nothing was deleted.");
  }

  const startedAt = new Date();
  const result = await Product.deleteMany({});
  // every product is gone, so every photo saved before now is unused — free the space
  // (photos uploaded while this was running are kept)
  await Image.deleteMany({ createdAt: { $lte: startedAt } });
  siteCache.clear();
  console.log(`[audit] ${user.email} deleted ALL products (${result.deletedCount}) at ${startedAt.toISOString()}`);
  res.redirect(`/admin?notice=${encodeURIComponent(`All products deleted (${result.deletedCount}).`)}`);
});

router.post("/products", handleUpload, async (req, res) => {
  try {
    if (req.uploadError) throw new Error(req.uploadError);
    const files = req.files || [];
    const images = files.filter((f) => f.fieldname === "images").map((f) => f.url);
    if (images.length === 0) {
      throw new Error("Please choose at least one product image.");
    }
    const categories = await Category.listOrSeed();
    if (!categories.some((c) => c.key === req.body.category)) {
      throw new Error("Please choose a valid category.");
    }
    if (req.body.showInSlider === "on" && (await sliderIsFull())) {
      throw new Error(`The homepage image slider is full (${MAX_SLIDER_IMAGES} max). Remove another product from the slider first.`);
    }

    await Product.create({ ...productPayload(req.body, files), images });
    siteCache.clear();
    res.redirect("/admin?notice=Product created");
  } catch (err) {
    await upload.discardUploads(req); // don't leave orphaned photos in the database
    const [sliderCount, categories, mainProducts] = await Promise.all([
      Product.countDocuments({ showInSlider: true }),
      Category.listOrSeed(),
      loadMainProducts(),
    ]);
    res.status(400).render("admin/productForm", {
      title: "New Product — Jody Office Admin",
      categories,
      product: null,
      values: req.body,
      error: friendlyError(err),
      sliderCount,
      maxSliderImages: MAX_SLIDER_IMAGES,
      mainProducts,
    });
  }
});

router.get("/products/:id/edit", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.redirect("/admin?error=Product not found");
  }
  const product = await Product.findById(req.params.id);
  if (!product) return res.redirect("/admin?error=Product not found");
  const [sliderCount, categories] = await Promise.all([
    Product.countDocuments({ showInSlider: true, _id: { $ne: product._id } }),
    Category.listOrSeed(),
  ]);
  res.render("admin/productForm", {
    title: "Edit Product — Jody Office Admin",
    categories,
    product,
    values: null,
    error: null,
    sliderCount,
    maxSliderImages: MAX_SLIDER_IMAGES,
  });
});

router.post("/products/:id", handleUpload, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.redirect("/admin?error=Product not found");
  }

  try {
    if (req.uploadError) throw new Error(req.uploadError);
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect("/admin?error=Product not found");

    const categories = await Category.listOrSeed();
    if (!categories.some((c) => c.key === req.body.category)) {
      throw new Error("Please choose a valid category.");
    }

    if (req.body.showInSlider === "on" && !product.showInSlider && (await sliderIsFull(product._id))) {
      throw new Error(`The homepage image slider is full (${MAX_SLIDER_IMAGES} max). Remove another product from the slider first.`);
    }

    const files = req.files || [];
    const oldUrls = Image.urlsOf(product);
    Object.assign(product, productPayload(req.body, files));

    product.slug = slugify(req.body.nameEn || req.body.nameAr, product._id.toString());

    const newImages = files.filter((f) => f.fieldname === "images").map((f) => f.url);
    if (newImages.length > 0) product.images = newImages;

    await product.save();
    const keep = Image.urlsOf(product);
    await Image.removeByUrls(oldUrls.filter((u) => !keep.includes(u))); // free space used by replaced photos
    siteCache.clear();
    res.redirect("/admin?notice=Product updated");
  } catch (err) {
    await upload.discardUploads(req);
    const product = await Product.findById(req.params.id).catch(() => null);
    const [sliderCount, categories] = await Promise.all([
      Product.countDocuments({ showInSlider: true, _id: { $ne: req.params.id } }),
      Category.listOrSeed(),
    ]);
    res.status(400).render("admin/productForm", {
      title: "Edit Product — Jody Office Admin",
      categories,
      product,
      values: req.body,
      error: friendlyError(err),
      sliderCount,
      maxSliderImages: MAX_SLIDER_IMAGES,
    });
  }
});

router.post("/products/:id/delete", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.redirect("/admin?error=Product not found");
  }
  const deleted = await Product.findByIdAndDelete(req.params.id);
  if (deleted) await Image.removeByUrls(Image.urlsOf(deleted));
  siteCache.clear();
  res.redirect("/admin?notice=Product deleted");
});

router.get("/categories", async (req, res) => {
  const categories = await Category.listOrSeed();
  res.render("admin/categories", {
    title: "Categories — Jody Office Admin",
    categories,
    notice: req.query.notice || null,
    error: req.query.error || null,
  });
});

router.post("/categories", async (req, res) => {
  try {
    const key = slugify((req.body.key || "").trim(), "");
    const labelEn = (req.body.labelEn || "").trim();
    const labelAr = (req.body.labelAr || "").trim();
    if (!key || !labelEn || !labelAr) {
      throw new Error("Please fill in the key and both labels.");
    }
    const count = await Category.countDocuments();
    await Category.create({ key, label: { en: labelEn, ar: labelAr }, order: count });
    siteCache.clear();
    res.redirect("/admin/categories?notice=Category added");
  } catch (err) {
    const message = err.code === 11000 ? "A category with that key already exists." : friendlyError(err);
    res.redirect(`/admin/categories?error=${encodeURIComponent(message)}`);
  }
});

router.post("/categories/:id/delete", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.redirect("/admin/categories?error=Category not found");
  }
  const category = await Category.findById(req.params.id);
  if (!category) return res.redirect("/admin/categories?error=Category not found");

  const inUse = await Product.countDocuments({ category: category.key });
  if (inUse > 0) {
    return res.redirect(
      `/admin/categories?error=${encodeURIComponent(
        `"${category.label.en}" is used by ${inUse} product(s). Move or delete those products first.`
      )}`
    );
  }

  await Category.findByIdAndDelete(req.params.id);
  siteCache.clear();
  res.redirect("/admin/categories?notice=Category deleted");
});

router.get("/stock-import", async (req, res) => {
  res.render("admin/stockImport", {
    title: "Stock Import — Jody Office Admin",
    notice: req.query.notice || null,
    error: req.query.error || null,
    results: null,
  });
});

router.post("/stock-import", handleCsvUpload, async (req, res) => {
  try {
    if (req.uploadError) throw new Error(req.uploadError);
    if (!req.file) throw new Error("Please choose a CSV file first.");
    const rows = parseStockCsv(req.file.buffer);
    if (rows.length === 0) {
      throw new Error("No usable rows found. Each line should read: model number, quantity.");
    }

    if (rows.length > MAX_CSV_ROWS) {
      throw new Error(`That file has more than ${MAX_CSV_ROWS} rows.`);
    }

    // One query to load the model numbers, one bulk write to update — instead of one query per CSV row.
    const products = await Product.find({ modelNumber: { $exists: true, $ne: "" } }).select("modelNumber name").lean();
    const byModel = new Map(products.map((p) => [p.modelNumber.trim().toLowerCase(), p]));

    const updated = [];
    const notFound = [];
    const operations = [];
    for (const row of rows) {
      const product = byModel.get(row.modelNumber.trim().toLowerCase());
      if (!product) {
        notFound.push(row.modelNumber);
        continue;
      }
      operations.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { stockQuantity: row.stockQuantity, inStock: row.stockQuantity > 0 } },
        },
      });
      updated.push({ modelNumber: product.modelNumber, name: product.name.en, stockQuantity: row.stockQuantity });
    }
    if (operations.length) await Product.bulkWrite(operations, { ordered: false });
    siteCache.clear();

    res.render("admin/stockImport", {
      title: "Stock Import — Jody Office Admin",
      notice: `${updated.length} product(s) updated.${notFound.length ? ` ${notFound.length} model number(s) not matched.` : ""}`,
      error: null,
      results: { updated, notFound },
    });
  } catch (err) {
    res.status(400).render("admin/stockImport", {
      title: "Stock Import — Jody Office Admin",
      notice: null,
      error: err.message || "Something went wrong reading that file.",
      results: null,
    });
  }
});

router.get("/settings", async (req, res) => {
  const settings = await Settings.getSingleton();
  res.render("admin/settings", {
    title: "Site Settings — Jody Office Admin",
    settings,
    notice: req.query.notice || null,
    error: req.query.error || null,
  });
});

router.post("/settings", async (req, res) => {
  try {
    const settings = await Settings.getSingleton();
    const b = req.body;

    settings.tagline = { en: b.taglineEn, ar: b.taglineAr };
    settings.metaDescription = { en: b.metaDescriptionEn, ar: b.metaDescriptionAr };
    settings.hero = {
      title: { en: b.heroTitleEn, ar: b.heroTitleAr },
      subtitle: { en: b.heroSubtitleEn, ar: b.heroSubtitleAr },
      cta: { en: b.heroCtaEn, ar: b.heroCtaAr },
    };
    settings.about = {
      title: { en: b.aboutTitleEn, ar: b.aboutTitleAr },
      body: { en: b.aboutBodyEn, ar: b.aboutBodyAr },
    };
    settings.footer = {
      email: (b.footerEmail || "").trim() || settings.footer.email,
      rightsText: { en: b.footerRightsEn, ar: b.footerRightsAr },
    };

    const indices = new Set();
    Object.keys(b).forEach((k) => {
      const m = k.match(/^socialName_(\d+)$/);
      if (m) indices.add(m[1]);
    });
    const socialLinks = [];
    indices.forEach((i) => {
      const name = (b[`socialName_${i}`] || "").trim();
      const url = safeUrl(b[`socialUrl_${i}`]);
      if (name && url) socialLinks.push({ name, url });
    });
    settings.socialLinks = socialLinks;

    settings.whatsappNumbers = parsePhoneRows(b, "whatsapp", (num) => num.replace(/[^\d]/g, ""));
    settings.contactNumbers = parsePhoneRows(b, "contact", (num) => num.trim());

    await settings.save();
    siteCache.clear();
    res.redirect("/admin/settings?notice=Settings saved");
  } catch (err) {
    res.redirect(`/admin/settings?error=${encodeURIComponent(friendlyError(err))}`);
  }
});

function parsePhoneRows(body, prefix, cleanNumber) {
  const indices = new Set();
  Object.keys(body).forEach((k) => {
    const m = k.match(new RegExp(`^${prefix}Number_(\\d+)$`));
    if (m) indices.add(m[1]);
  });
  const rows = [];
  indices.forEach((i) => {
    const number = cleanNumber((body[`${prefix}Number_${i}`] || "").toString());
    if (!number) return;
    rows.push({
      label: (body[`${prefix}Label_${i}`] || "").trim(),
      number,
      active: body[`${prefix}Active_${i}`] === "on",
    });
  });
  return rows;
}

function friendlyError(err) {
  if (err.code === 11000) {
    return "A product with that name already exists — try a slightly different name.";
  }
  if (err.name === "ValidationError") {
    return Object.values(err.errors)
      .map((e) => e.message)
      .join(" ");
  }
  return err.message || "Something went wrong saving this product. Please try again.";
}

module.exports = router;

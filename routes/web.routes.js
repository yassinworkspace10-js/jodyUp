const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const siteCache = require("../utils/siteCache");
const { MAX_SLIDER_IMAGES, LOW_STOCK_THRESHOLD, SIZE_KEYS, CARD_PROJECTION } = Product;

const PAGE_SIZE = 24;

function sortFor(sortKey) {
  if (sortKey === "price_asc") return { priceEGP: 1 };
  if (sortKey === "price_desc") return { priceEGP: -1 };
  return { createdAt: -1 };
}

// ?q=a&q=b arrives as an array — always work with a single plain string.
function str(value) {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v : undefined;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", async (req, res) => {
  const { locale, t, prefix, categoryLabel, navCategories } = res.locals;

  // Homepage blocks are shared by every visitor — cached for 30s (cleared when the admin edits a product).
  const home = await siteCache.cached("home", 30 * 1000, async () => {
    const [featured, tiles, slider] = await Promise.all([
      Product.find({ featured: true }).sort({ createdAt: -1 }).limit(4).select(CARD_PROJECTION).lean(),
      Product.aggregate([
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$category", image: { $first: { $arrayElemAt: ["$images", 0] } } } },
      ]),
      Product.find({ showInSlider: true }).sort({ createdAt: -1 }).limit(MAX_SLIDER_IMAGES).select({ images: { $slice: 1 } }).lean(),
    ]);
    return { featured, tiles, slider };
  });

  const imageByCategory = new Map(home.tiles.map((x) => [x._id, x.image]));
  const categoryTiles = navCategories
    .filter((cat) => imageByCategory.get(cat))
    .map((cat) => ({ category: cat, label: categoryLabel(cat), image: imageByCategory.get(cat) }));

  const heroSlides = (home.slider.length ? home.slider.map((item) => item.images[0]) : categoryTiles.map((tile) => tile.image)).filter(Boolean);

  res.render("index", {
    title: t.tagline,
    description: t.metaDescription,
    activeNav: "home",
    canonicalUrl: `${res.locals.siteUrl}${prefix}/`,
    featuredProducts: home.featured,
    categoryTiles,
    heroSlides,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
  });
});

router.get("/shop", async (req, res) => {
  const { locale, t, prefix, categoryLabel } = res.locals;
  const category = str(req.query.category);
  const q = str(req.query.q);
  const sort = str(req.query.sort);
  const size = str(req.query.size);
  const color = str(req.query.color);
  const minPrice = str(req.query.minPrice);
  const maxPrice = str(req.query.maxPrice);
  const filter = {};
  if (category) filter.category = category;
  if (q) filter[`name.${locale}`] = { $regex: escapeRegex(q.trim()), $options: "i" };
  if (size) filter.sizes = size;
  if (color) filter["colors.name"] = color;

  const min = minPrice !== undefined && minPrice !== "" ? Number(minPrice) : null;
  const max = maxPrice !== undefined && maxPrice !== "" ? Number(maxPrice) : null;
  if ((min !== null && !Number.isNaN(min)) || (max !== null && !Number.isNaN(max))) {
    filter.priceEGP = {};
    if (min !== null && !Number.isNaN(min)) filter.priceEGP.$gte = min;
    if (max !== null && !Number.isNaN(max)) filter.priceEGP.$lte = max;
  }

  const sortKey = ["newest", "price_asc", "price_desc"].includes(sort) ? sort : "newest";

  const requestedPage = Number.parseInt(str(req.query.page), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [products, total, filterOptions] = await Promise.all([
    Product.find(filter)
      .sort(sortFor(sortKey))
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .select(CARD_PROJECTION)
      .lean(),
    Product.countDocuments(filter),
    // the size/colour filter lists change rarely — cached for 60s
    siteCache.cached("shop-filters", 60 * 1000, async () => {
      const [sizes, colors] = await Promise.all([Product.distinct("sizes"), Product.distinct("colors.name")]);
      return { sizes, colors };
    }),
  ]);
  const availableSizes = filterOptions.sizes;
  const availableColors = filterOptions.colors;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // link to another page of the same filtered list
  const pageUrl = (n) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    if (size) params.set("size", size);
    if (color) params.set("color", color);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (sortKey !== "newest") params.set("sort", sortKey);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return `${prefix}/shop${qs ? `?${qs}` : ""}`;
  };

  const breadcrumbs = [{ name: t.home, url: `${prefix}/` }, { name: t.nav_shop, url: `${prefix}/shop` }];
  if (category) breadcrumbs.push({ name: categoryLabel(category), url: `${prefix}/shop?category=${category}` });

  const canonicalUrl = `${res.locals.siteUrl}${prefix}/shop${category ? `?category=${category}` : ""}`;

  res.render("shop", {
    title: category ? `${categoryLabel(category)} — ${t.brand}` : `${t.shop_all} — ${t.brand}`,
    description: t.metaDescription,
    activeNav: "shop",
    canonicalUrl,
    breadcrumbs,
    products,
    activeCategory: category || null,
    search: q || "",
    sort: sortKey,
    availableSizes: SIZE_KEYS.filter((s) => availableSizes.includes(s)),
    availableColors: availableColors.filter(Boolean).sort(),
    activeSize: size || "",
    activeColor: color || "",
    minPrice: min !== null && !Number.isNaN(min) ? min : "",
    maxPrice: max !== null && !Number.isNaN(max) ? max : "",
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    page: Math.min(page, totalPages),
    totalPages,
    pageUrl,
  });
});

router.get("/wishlist", (req, res) => {
  const { t, prefix } = res.locals;
  res.render("wishlist", {
    title: `${t.wishlist_page_title} — ${t.brand}`,
    description: t.metaDescription,
    activeNav: "wishlist",
    canonicalUrl: `${res.locals.siteUrl}${prefix}/wishlist`,
    robots: "noindex, follow",
    breadcrumbs: [{ name: t.home, url: `${prefix}/` }, { name: t.wishlist_page_title, url: `${prefix}/wishlist` }],
  });
});

router.get("/product/:slug", async (req, res) => {
  const { locale, t, prefix, categoryLabel, whatsappNumbers } = res.locals;
  const product = await Product.findOne({ slug: req.params.slug }).lean();
  if (!product) {
    return res.status(404).render("404", { title: t.product_not_found });
  }

  // Fire-and-forget view count for the "most viewed" admin dashboard widget —
  // doesn't block the page render.
  Product.updateOne({ _id: product._id }, { $inc: { views: 1 } }).catch(() => {});

  const relatedProducts = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
  })
    .sort({ createdAt: -1 })
    .limit(4)
    .select(CARD_PROJECTION)
    .lean();

  const canonicalUrl = `${res.locals.siteUrl}${prefix}/product/${product.slug}`;
  const name = product.name[locale];

  res.render("product", {
    title: `${name} — ${t.brand}`,
    description: (product.description[locale] || "").slice(0, 160),
    product,
    relatedProducts,
    whatsappNumbers,
    canonicalUrl,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    breadcrumbs: [
      { name: t.home, url: `${prefix}/` },
      { name: t.nav_shop, url: `${prefix}/shop` },
      { name: categoryLabel(product.category), url: `${prefix}/shop?category=${product.category}` },
      { name, url: `${prefix}/product/${product.slug}` },
    ],
  });
});

module.exports = router;

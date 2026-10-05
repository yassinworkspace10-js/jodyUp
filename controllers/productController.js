const Product = require("../models/Product");
const AppError = require("../utils/AppError");
const httpStatusText = require("../utils/httpStatusText");
const Image = require("../models/Image");
const asyncWrapper = require("../middlewares/asyncWrapper");
const siteCache = require("../utils/siteCache");
const { slugify } = Product;

function parseList(value) {
  if (Array.isArray(value)) return value;
  return value
    ? String(value)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : undefined;
}

function parseColors(value) {
  return Array.isArray(value) ? value : undefined;
}

function readBilingual(body, field) {
  if (body[field] && typeof body[field] === "object") return body[field];
  const en = body[`${field}En`];
  const ar = body[`${field}Ar`];
  if (en !== undefined || ar !== undefined) return { en, ar };
  return undefined;
}

const getAllProducts = asyncWrapper(async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const ids = typeof req.query.ids === "string" ? req.query.ids : undefined;
  const filter = {};
  if (category) filter.category = category;

  if (ids) {
    const idList = String(ids)
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^[a-f\d]{24}$/i.test(id))
      .slice(0, 100);
    filter._id = { $in: idList };
  }
  const products = await Product.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  res.status(200).json({ status: httpStatusText.SUCCESS, data: { products } });
});

const getProductBySlug = asyncWrapper(async (req, res, next) => {
  const product = await Product.findOne({ slug: String(req.params.slug) }).lean();
  if (!product) {
    return next(new AppError(404, "Product not found", httpStatusText.FAIL));
  }
  res.status(200).json({ status: httpStatusText.SUCCESS, data: { product } });
});

const createProduct = asyncWrapper(async (req, res, next) => {
  const name = readBilingual(req.body, "name");
  const description = readBilingual(req.body, "description");
  const { priceEGP, category } = req.body;

  if (
    !name ||
    !name.en ||
    !name.ar ||
    !description ||
    !description.en ||
    !description.ar ||
    !priceEGP ||
    !category
  ) {
    return next(
      new AppError(
        400,
        "name (en & ar), description (en & ar), priceEGP and category are required",
        httpStatusText.FAIL,
      ),
    );
  }

  const images = (req.files || []).map((file) => file.url);
  if (images.length === 0) {
    return next(
      new AppError(
        400,
        "At least one product image is required",
        httpStatusText.FAIL,
      ),
    );
  }

  const product = await Product.create({
    name,
    description,
    priceEGP,
    modelNumber: req.body.modelNumber,
    category,
    images,
    sizes: parseList(req.body.sizes) || [],
    colors: parseColors(req.body.colors) || [],
    inStock:
      req.body.inStock !== undefined
        ? req.body.inStock === "true" || req.body.inStock === true
        : true,
    featured: req.body.featured === "true" || req.body.featured === true,
  });

  siteCache.clear();
  res.status(201).json({ status: httpStatusText.SUCCESS, data: { product } });
});

const updateProduct = asyncWrapper(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return next(new AppError(404, "Product not found", httpStatusText.FAIL));
  }

  const name = readBilingual(req.body, "name");
  const description = readBilingual(req.body, "description");
  const { priceEGP, modelNumber, category, sizes, colors, inStock, featured } =
    req.body;

  if (name) {
    if (name.en !== undefined) product.name.en = name.en;
    if (name.ar !== undefined) product.name.ar = name.ar;
  }
  if (description) {
    if (description.en !== undefined) product.description.en = description.en;
    if (description.ar !== undefined) product.description.ar = description.ar;
  }
  if (priceEGP) product.priceEGP = priceEGP;
  if (modelNumber !== undefined) product.modelNumber = modelNumber;
  if (category) product.category = category;
  if (sizes !== undefined) product.sizes = parseList(sizes) || [];
  if (colors !== undefined) product.colors = parseColors(colors) || [];
  if (inStock !== undefined)
    product.inStock = inStock === "true" || inStock === true;
  if (featured !== undefined)
    product.featured = featured === "true" || featured === true;

  if (name && (name.en || name.ar)) {

    product.slug = slugify(
      product.name.en || product.name.ar,
      product._id.toString(),
    );
  }

  const newImages = (req.files || []).map(
    (file) => file.url,
  );
  if (newImages.length > 0) {
    product.images = newImages;
  }

  await product.save();
  siteCache.clear();
  res.status(200).json({ status: httpStatusText.SUCCESS, data: { product } });
});

const deleteProduct = asyncWrapper(async (req, res, next) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    return next(new AppError(404, "Product not found", httpStatusText.FAIL));
  }
  await Image.removeByUrls(Image.urlsOf(product));
  siteCache.clear();
  res.status(200).json({ status: httpStatusText.SUCCESS, data: null });
});

module.exports = {
  getAllProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
};

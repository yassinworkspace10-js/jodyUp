const mongoose = require("mongoose");

const MAX_SLIDER_IMAGES = 5;

const LOW_STOCK_THRESHOLD = 5;

// Fixed, site-wide size list (not admin-editable) — the key is what's stored
// on the product and used in URLs/filters; the labels are for display.
const SIZES = [
  { key: "S", en: "Small", ar: "صغير" },
  { key: "M", en: "Medium", ar: "متوسط" },
  { key: "L", en: "Large", ar: "كبير" },
  { key: "XL", en: "XLarge", ar: "كبير جدًا" },
  { key: "XXL", en: "XXLarge", ar: "كبير جدًا جدًا" },
];
const SIZE_KEYS = SIZES.map((s) => s.key);

const productSchema = new mongoose.Schema(
  {
    name: {
      en: { type: String, required: true, trim: true },
      ar: { type: String, required: true, trim: true },
    },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: {
      en: { type: String, required: true },
      ar: { type: String, required: true },
    },

    priceEGP: { type: Number, required: true, min: 0 },
    modelNumber: { type: String, trim: true, index: true },

    category: { type: String, required: true, trim: true, lowercase: true },
    images: [{ type: String, required: true }],
    sizes: [{ type: String, enum: SIZE_KEYS }],

    colors: [
      {
        name: { type: String, required: true, trim: true },
        images: [{ type: String, required: true }],
      },
    ],
    inStock: { type: Boolean, default: true },

    stockQuantity: { type: Number, min: 0, default: null },
    featured: { type: Boolean, default: false },

    showInSlider: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Indexes for the queries the storefront and admin run on every page.
productSchema.index({ createdAt: -1 });
productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ featured: 1, createdAt: -1 });
productSchema.index({ showInSlider: 1, createdAt: -1 });
productSchema.index({ priceEGP: 1 });
productSchema.index({ views: -1 });

// Fields a product *card* needs (no description/colors/etc.) and only the first photo —
// keeps list pages small and fast. Use with .select(CARD_PROJECTION).lean()
const CARD_PROJECTION = { description: 0, colors: 0, sizes: 0, views: 0, modelNumber: 0, images: { $slice: 1 } };

function slugify(str, fallback) {
  const slug = (str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || fallback || "";
}

productSchema.pre("validate", function () {
  if (!this.slug) {
    const source = (this.name && (this.name.en || this.name.ar)) || "";
    this.slug = slugify(source, this._id.toString());
  }
});

module.exports = mongoose.model("Product", productSchema);
module.exports.slugify = slugify;
module.exports.MAX_SLIDER_IMAGES = MAX_SLIDER_IMAGES;
module.exports.LOW_STOCK_THRESHOLD = LOW_STOCK_THRESHOLD;
module.exports.SIZES = SIZES;
module.exports.SIZE_KEYS = SIZE_KEYS;
module.exports.CARD_PROJECTION = CARD_PROJECTION;

const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {

    key: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    label: {
      en: { type: String, required: true, trim: true },
      ar: { type: String, required: true, trim: true },
    },

    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const DEFAULT_CATEGORIES = [
  { key: "dresses", label: { en: "Dresses", ar: "فساتين" } },
  { key: "tops", label: { en: "Tops", ar: "بلوزات" } },
  { key: "bottoms", label: { en: "Bottoms", ar: "بناطيل" } },
  { key: "skirts", label: { en: "Skirts", ar: "تنانير" } },
  { key: "outerwear", label: { en: "Outerwear", ar: "معاطف" } },
  { key: "accessories", label: { en: "Accessories", ar: "إكسسوارات" } },
];

const Category = mongoose.model("Category", categorySchema);

Category.listOrSeed = async function () {
  let cats = await Category.find().sort({ order: 1, key: 1 });
  if (cats.length === 0) {
    const seed = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i }));
    cats = await Category.insertMany(seed);
  }
  return cats;
};

module.exports = Category;

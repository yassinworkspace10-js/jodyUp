// One-time: moves old local /uploads/* images into MongoDB and updates the products.
// Run on the machine that still HAS the old files in ./uploads:  node scripts/migrateImages.js
require("dotenv").config();
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { processUpload } = require("../utils/imageProcessing");
const Product = require("../models/Product");
const Image = require("../models/Image");

async function move(url) {
  if (!url || !url.startsWith("/uploads/")) return url;
  const file = path.join(__dirname, "..", url);
  if (!fs.existsSync(file)) { console.log("  missing file, kept:", url); return url; }
  const { data, thumb } = await processUpload(fs.readFileSync(file));
  const doc = await Image.create({ data, thumb });
  console.log("  moved:", url);
  return `/img/${doc._id}.webp`;
}

(async () => {
  await mongoose.connect(process.env.MONGO_DB_URI);
  for (const p of await Product.find()) {
    p.images = await Promise.all(p.images.map(move));
    for (const c of p.colors || []) c.images = await Promise.all(c.images.map(move));
    await p.save();
    console.log("done:", p.name.en);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

const mongoose = require("mongoose");

// Product photos live in MongoDB itself (free, permanent, survives every redeploy).
// Served by GET /img/<id>.webp (full size) and /img/<id>_s.webp (thumbnail) — see app.js.
const imageSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  thumb: { type: Buffer }, // small version for product grids (made on upload, or lazily for older photos)
  contentType: { type: String, default: "image/webp" },
  createdAt: { type: Date, default: Date.now, index: true },
});

const Image = mongoose.model("Image", imageSchema);

// "/img/<id>.webp" -> id
const idFromUrl = (url) => {
  const m = /^\/img\/([a-f0-9]{24})\.webp$/.exec(url || "");
  return m ? m[1] : null;
};

// "/img/<id>.webp" -> "/img/<id>_s.webp"  (other URLs, e.g. legacy /uploads, are returned unchanged)
Image.thumbUrl = (url) => (idFromUrl(url) ? url.replace(/\.webp$/, "_s.webp") : url);

// Frees database space when a product is deleted or its photos are replaced.
Image.removeByUrls = async (urls) => {
  const ids = (urls || []).map(idFromUrl).filter(Boolean);
  if (ids.length) await Image.deleteMany({ _id: { $in: ids } });
};

// every photo URL a product uses (main + per-color)
Image.urlsOf = (product) => [
  ...(product.images || []),
  ...(product.colors || []).flatMap((c) => c.images || []),
];

module.exports = Image;

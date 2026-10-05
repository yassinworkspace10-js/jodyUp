const sharp = require("sharp");

// Keep memory/CPU use low on shared hosting.
sharp.cache(false);
sharp.concurrency(2);

const ALLOWED_FORMATS = ["jpeg", "png", "webp", "gif", "avif"];
const FULL_WIDTH = 1200;
const THUMB_WIDTH = 600;

function open(buffer) {
  // limitInputPixels blocks "decompression bomb" images; failOn rejects corrupt files.
  return sharp(buffer, { limitInputPixels: 50_000_000, failOn: "error" });
}

// Validates the real file content (not just the extension/mime the browser
// claims) and returns the full-size + thumbnail WebP buffers.
async function processUpload(buffer) {
  const meta = await open(buffer).metadata();
  if (!ALLOWED_FORMATS.includes(meta.format)) {
    throw new Error("Unsupported image format");
  }
  const [data, thumb] = await Promise.all([
    open(buffer).rotate().resize({ width: FULL_WIDTH, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
    open(buffer).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer(),
  ]);
  return { data, thumb };
}

async function makeThumb(webpBuffer) {
  return open(webpBuffer).resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
}

module.exports = { processUpload, makeThumb };

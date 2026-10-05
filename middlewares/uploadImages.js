const multer = require("multer");
const path = require("path");
const Image = require("../models/Image");
const AppError = require("../utils/AppError");
const httpStatusText = require("../utils/httpStatusText");
const { processUpload } = require("../utils/imageProcessing");

// Photos are validated, compressed (max 1200px WebP + a 600px thumbnail) and
// stored in MongoDB, NOT on the server disk, so redeploying never deletes them.
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype.startsWith("image/") && ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError(400, "Only JPG, PNG, WEBP, GIF or AVIF images are allowed", httpStatusText.FAIL), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 30, // stops a single request from flooding memory / the database
    fields: 200,
    fieldSize: 100 * 1024,
    parts: 260,
  },
});

async function saveImage(buffer) {
  const { data, thumb } = await processUpload(buffer);
  const doc = await Image.create({ data, thumb });
  return `/img/${doc._id}.webp`;
}

// Runs multer, then stores every file and sets file.url (permanent link).
// Every saved URL is remembered on req.savedImageUrls so the route can delete
// them again (discardUploads) if the product itself fails to save.
const withStorage = (multerMw) => (req, res, next) => {
  req.savedImageUrls = [];
  multerMw(req, res, async (err) => {
    if (err) return next(err);
    try {
      const files = req.files || [];
      // a few at a time: keeps memory low on small hosting plans
      for (let i = 0; i < files.length; i += 3) {
        await Promise.all(
          files.slice(i, i + 3).map(async (f) => {
            f.url = await saveImage(f.buffer);
            req.savedImageUrls.push(f.url);
            f.buffer = undefined; // release memory early
          })
        );
      }
      next();
    } catch (e) {
      await Image.removeByUrls(req.savedImageUrls).catch(() => {});
      next(new AppError(400, "Could not process one of the images. Please use a valid JPG/PNG/WEBP photo.", httpStatusText.FAIL));
    }
  });
};

// Call from a route's catch block: removes photos saved for a request that failed.
const discardUploads = (req) => Image.removeByUrls(req.savedImageUrls || []).catch(() => {});

module.exports = {
  any: () => withStorage(upload.any()),
  array: (name, max) => withStorage(upload.array(name, max)),
  discardUploads,
};

// Finds photos in the database that no product uses any more (e.g. from an upload that was
// abandoned) and deletes them to free space.
//   node scripts/cleanOrphanImages.js          -> only REPORTS what it would delete
//   node scripts/cleanOrphanImages.js --yes    -> actually deletes
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Image = require("../models/Image");

(async () => {
  await mongoose.connect(process.env.MONGO_DB_URI);
  const used = new Set();
  const cursor = Product.find().select("images colors").lean().cursor();
  for await (const p of cursor) {
    Image.urlsOf(p).forEach((u) => {
      const m = /^\/img\/([a-f0-9]{24})\.webp$/.exec(u || "");
      if (m) used.add(m[1]);
    });
  }
  // photos younger than 1 hour are skipped: they may belong to a product being created right now
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const candidates = await Image.find({ createdAt: { $lte: cutoff } }).select("_id").lean();
  const orphans = candidates.filter((i) => !used.has(String(i._id))).map((i) => i._id);
  console.log(`${used.size} photo(s) in use, ${orphans.length} unused.`);
  if (orphans.length && process.argv.includes("--yes")) {
    await Image.deleteMany({ _id: { $in: orphans } });
    console.log("Deleted the unused photos.");
  } else if (orphans.length) {
    console.log("Run again with --yes to delete them.");
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

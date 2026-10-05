const mongoose = require("mongoose");

// Maps to the pre-existing "mainProducts" collection (imported from the
// Soft Magic/ERP stock list — ~2000 raw items with knum/name/price/balance).
// This is a read-only lookup used by the admin "New product" picker; it is
// NOT the schema used to render the storefront (see models/Product.js).
const mainProductSchema = new mongoose.Schema(
  {
    knum: { type: String, trim: true },
    available: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
    name: { type: String, trim: true },
    price: { type: Number },
  },
  { collection: "mainProducts", strict: false, autoIndex: false }
);

module.exports = mongoose.model("MainProduct", mainProductSchema, "mainProducts");

const mongoose = require("mongoose");
const userRoles = require("../utils/roles");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: Object.values(userRoles), default: userRoles.USER },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

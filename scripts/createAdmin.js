const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const dns = require("dns");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const userRoles = require("../utils/roles");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function main() {
  const [, , name, email, password] = process.argv;

  if (!name || !email || !password) {
    console.error("Usage: node scripts/createAdmin.js \"Full Name\" \"email@example.com\" \"password\"");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  if (!process.env.MONGO_DB_URI) {
    console.error("MONGO_DB_URI is not set — check your .env file.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_DB_URI);

  const hashedPassword = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email: email.trim().toLowerCase() });

  if (existing) {
    existing.password = hashedPassword;
    existing.name = name;
    existing.role = userRoles.ADMIN;
    await existing.save();
    console.log(`Updated existing account — you can now log in as ${email} at /admin/login.`);
  } else {
    await User.create({ name, email, password: hashedPassword, role: userRoles.ADMIN });
    console.log(`Admin account created — log in as ${email} at /admin/login.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed to create admin account:", err.message);
  process.exit(1);
});

const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authHandler = require("../middlewares/authHandler");
const allowedTo = require("../middlewares/allowedTo");
const userRoles = require("../utils/roles");

// Registering creates a login for the admin panel, so it must never be open to
// the public — only an already-authenticated ADMIN can create accounts (the
// first admin comes from `npm run create-admin`; more can be added in /admin/users).
router.post("/register", authHandler, allowedTo(userRoles.ADMIN), authController.register);
router.post("/login", authController.login);

module.exports = router;

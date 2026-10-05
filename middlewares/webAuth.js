const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Admin panel session check. The role is re-read from the database on every
// request, so deleting a user or changing their role takes effect immediately
// (a stolen/old cookie of a removed account stops working at once).
module.exports = async (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.redirect("/admin/login");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, { algorithms: ["HS256"] });
    const user = await User.findById(decoded.id).select("email name role").lean();
    if (!user) throw new Error("user no longer exists");
    req.verfiy = { id: String(user._id), email: user.email, role: user.role };
    res.locals.currentUser = req.verfiy;
    next();
  } catch (err) {
    res.clearCookie("token");
    return res.redirect("/admin/login");
  }
};

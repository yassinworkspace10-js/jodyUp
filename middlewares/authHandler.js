const jwt = require("jsonwebtoken");
const httpStatusText = require("../utils/httpStatusText");
const AppError = require("../utils/AppError.js");
const User = require("../models/User");

// Bearer-token check for the JSON API. Role is read fresh from the database.
const authHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) throw new AppError(401, "token required", httpStatusText.ERROR);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, { algorithms: ["HS256"] });
  } catch (err) {
    throw new AppError(401, "token invalid", httpStatusText.ERROR);
  }
  const user = await User.findById(decoded.id).select("email role").lean();
  if (!user) throw new AppError(401, "token invalid", httpStatusText.ERROR);
  req.verfiy = { id: String(user._id), email: user.email, role: user.role };
  next();
};

module.exports = authHandler;

const bcrypt = require("bcryptjs");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const httpStatusText = require("../utils/httpStatusText");
const asyncWrapper = require("../middlewares/asyncWrapper");
const generateJWT = require("../utils/generateJWT");
const userRoles = require("../utils/roles");

const register = asyncWrapper(async (req, res, next) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return next(new AppError(400, "name, email and password are required", httpStatusText.FAIL));
  }
  if (String(password).length < 8) {
    return next(new AppError(400, "password must be at least 8 characters", httpStatusText.FAIL));
  }

  const existing = await User.findOne({ email: String(email).trim().toLowerCase() });
  if (existing) {
    return next(new AppError(409, "Email already registered", httpStatusText.FAIL));
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: String(email).trim().toLowerCase(),
    password: hashedPassword,
    role: Object.values(userRoles).includes(role) ? role : userRoles.USER,
  });

  const token = await generateJWT({ email: user.email, id: user._id, role: user.role });

  res.status(201).json({
    status: httpStatusText.SUCCESS,
    data: { user: { id: user._id, name: user.name, email: user.email, role: user.role }, token },
  });
});

const login = asyncWrapper(async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return next(new AppError(400, "email and password are required", httpStatusText.FAIL));
  }

  const user = await User.findOne({ email: String(email).trim().toLowerCase() });
  if (!user) {
    return next(new AppError(401, "Invalid credentials", httpStatusText.FAIL));
  }

  const matched = await bcrypt.compare(String(password), user.password);
  if (!matched) {
    return next(new AppError(401, "Invalid credentials", httpStatusText.FAIL));
  }

  const token = await generateJWT({ email: user.email, id: user._id, role: user.role });

  res.status(200).json({
    status: httpStatusText.SUCCESS,
    data: { user: { id: user._id, name: user.name, email: user.email, role: user.role }, token },
  });
});

module.exports = { register, login };

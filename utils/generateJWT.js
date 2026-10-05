const jwt = require("jsonwebtoken");

module.exports = async (payload, expiresIn = "7d") => {
  return jwt.sign(payload, process.env.JWT_SECRET_KEY, { algorithm: "HS256", expiresIn });
};

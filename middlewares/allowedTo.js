const AppError = require("../utils/AppError");
const httpStatusText = require("../utils/httpStatusText");

module.exports = (...roles) => {
  return (req, res, next) => {
    if (!req.verfiy || !roles.includes(req.verfiy.role)) {
      throw new AppError(403, "forbidden", httpStatusText.FAIL);
    }
    next();
  };
};

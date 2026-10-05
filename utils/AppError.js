class AppError extends Error {
  constructor(statusCode, message, statusText) {
    super(message);

    this.statusCode = statusCode;
    this.statusText = statusText;
  }
}

module.exports = AppError;

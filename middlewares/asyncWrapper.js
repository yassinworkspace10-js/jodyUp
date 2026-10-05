module.exports = (func) => {
  return (req, res, next) => {
    Promise.resolve(func(req, res, next)).catch(next); // keep the original error (and its status code)
  };
};

// CSRF protection for the admin panel: every state-changing request (POST etc.)
// must come from this same site. Browsers always send Origin (or at least
// Referer) on form posts, so a request coming from another website is rejected.
module.exports = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const source = req.get("origin") || req.get("referer");
  let ok = false;
  if (source) {
    try {
      ok = new URL(source).host === req.get("host");
    } catch (e) {
      ok = false;
    }
  }
  if (!ok) {
    return res.status(403).send("Blocked: this request did not come from this site.");
  }
  next();
};

const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const siteCache = require("../utils/siteCache");

router.get("/sitemap.xml", async (req, res) => {
  const baseUrl = res.locals.siteUrl;
  const products = await siteCache.cached("sitemap-products", 10 * 60 * 1000, () =>
    Product.find().select("slug updatedAt").lean()
  );
  const today = new Date().toISOString().split("T")[0];

  const prefixes = ["", "/ar"];
  const urls = [];

  prefixes.forEach((prefix) => {
    urls.push(
      `<url><loc>${baseUrl}${prefix}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      `<url><loc>${baseUrl}${prefix}/shop</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`
    );
    res.locals.navCategories.forEach((cat) => {
      urls.push(
        `<url><loc>${baseUrl}${prefix}/shop?category=${encodeURIComponent(cat)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
      );
    });
    products.forEach((p) => {
      urls.push(
        `<url><loc>${baseUrl}${prefix}/product/${encodeURIComponent(p.slug)}</loc><lastmod>${p.updatedAt
          .toISOString()
          .split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`
      );
    });
  });

  res.header("Content-Type", "application/xml");
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join(
      ""
    )}</urlset>`
  );
});

module.exports = router;

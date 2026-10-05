const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const authHandler = require("../middlewares/authHandler");
const allowedTo = require("../middlewares/allowedTo");
const upload = require("../middlewares/uploadImages");
const userRoles = require("../utils/roles");

router.get("/", productController.getAllProducts);
router.get("/:slug", productController.getProductBySlug);

router.post(
  "/",
  authHandler,
  allowedTo(userRoles.ADMIN),
  upload.array("images", 6),
  productController.createProduct
);

router.patch(
  "/:id",
  authHandler,
  allowedTo(userRoles.ADMIN),
  upload.array("images", 6),
  productController.updateProduct
);

router.delete(
  "/:id",
  authHandler,
  allowedTo(userRoles.ADMIN),
  productController.deleteProduct
);

module.exports = router;

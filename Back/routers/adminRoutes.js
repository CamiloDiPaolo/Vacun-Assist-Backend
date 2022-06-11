const express = require("express");
const adminUtils = require("../controllers/adminUtils");
const authController = require("../controllers/authController");

const adminRouter = express.Router();

adminRouter
  .route("/add-stock")
  .post(
    authController.protect,
    authController.restrictTo("admin"),
    adminUtils.addStock
  );

adminRouter
  .route("/sub-stock")
  .post(
    authController.protect,
    authController.restrictTo("admin"),
    adminUtils.subStock
  );

module.exports = adminRouter;

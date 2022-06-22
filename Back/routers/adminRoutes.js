const express = require("express");
const adminUtils = require("../controllers/adminUtils");
const authController = require("../controllers/authController");

const adminRouter = express.Router();

adminRouter
  .route("/get-stock")
  .post(
    authController.protect,
    authController.restrictTo("admin", "vacc"),
    adminUtils.getStock
  );

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

adminRouter
  .route("/get-stats")
  .post(
    authController.protect,
    authController.restrictTo("admin"),
    adminUtils.getStats
  );

module.exports = adminRouter;

const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");

const userRouter = express.Router();

// registro de usuario y logeo general
userRouter.route("/signup").post(authController.signup);
userRouter.route("/signup/:token").post(authController.confirmAcount);
userRouter.route("/login").post(authController.login);
userRouter.route("/logout").post(authController.logout);

// registro de vacunadores u otros usuarios por el admin
userRouter
  .route("/createUser")
  .post(
    authController.protect,
    authController.restrictTo("admin"),
    userController.createUserRenaper
  );

userRouter
  .route("/")
  .get(
    authController.protect,
    authController.restrictTo("admin"),
    userController.getAllUsers
  );
userRouter.route("/:dni").get(userController.getUser);

module.exports = userRouter;

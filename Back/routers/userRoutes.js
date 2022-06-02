const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");

const userRouter = express.Router();

// registro de usuario y logeo general
userRouter.route("/signup").post(authController.signup);
userRouter.route("/signup-confirm").post(authController.confirmAcount);
userRouter.route("/login").post(authController.login);
userRouter.route("/logout").post(authController.logout);

// registro de vacunadores u otros usuarios por el admin
userRouter
  .route("/signup-vacc")
  .post(
    authController.protect,
    authController.restrictTo("admin"),
    authController.signupVacc
  );

userRouter
  .route("/")
  .get(
    authController.protect,
    authController.restrictTo("admin"),
    userController.getAllUsers
  );
// actualizacion de datos de salud
userRouter
  .route("/healthData")
  .put(
    authController.protect,
    authController.restrictTo("user"),
    userController.updateHealthData
  );

// obtenes los datos del usuario actualmente registrado
userRouter
  .route("/get-logged-user")
  .get(authController.protect, (req, res, next) => {
    res.status(200).json({ status: "success", data: req.user });
  });

userRouter.route("/get-user").get(userController.getUser);

module.exports = userRouter;

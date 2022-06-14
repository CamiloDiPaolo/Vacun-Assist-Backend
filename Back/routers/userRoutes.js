const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const vaccineAplication = require("../controllers/vaccineAplication");
const adminUtils = require("../controllers/adminUtils");

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
    adminUtils.signupVacc
  );

// obtenemos todos los usuarios
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

// obtenemos los datos de un usuario
// userRouter.route("/get-user/:dni").get(userController.getUser);

// obtenemos los datos de un usuario por el renaper
userRouter
  .route("/get-user-renaper/:dni")
  .get(
    authController.protect,
    authController.restrictTo("admin"),
    adminUtils.getUserRenaper
  );

// registramos la aplicacion de una vacuna
userRouter
  .route("/vaccineAplication")
  .post(
    authController.protect,
    authController.restrictTo("user"),
    vaccineAplication.vaccineAplication
  );

module.exports = userRouter;

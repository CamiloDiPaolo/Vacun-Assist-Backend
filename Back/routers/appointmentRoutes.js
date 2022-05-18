const express = require("express");
const authController = require("../controllers/authController");
const appointmentController = require("../controllers/appointmentController");

const appointmentRouter = express.Router();

// sacar turno local
appointmentRouter
  .route("/virtual")
  .post(
    authController.protect,
    authController.restrictTo("user"),
    appointmentController.createAppointmentVirtual
  );

appointmentRouter
  .route("/local")
  .post(
    authController.protect,
    authController.restrictTo("vacc"),
    appointmentController.createAppointmentLocal
  );

// validar turno
appointmentRouter
  .route("/validate")
  .post(
    authController.protect,
    authController.restrictTo("vacc"),
    appointmentController.validateAppointment
  );
// cancelar un turno como usuario
appointmentRouter
  .route("/cancel")
  .post(
    authController.protect,
    authController.restrictTo("user"),
    appointmentController.cancelAppointment
  );
// obtener los turnos
appointmentRouter
  .route("/")
  .get(authController.protect, appointmentController.getAppointments);

// sacar turno local

// finalizar turno (recibe id de turno)

// obtener todos los turnos

module.exports = appointmentRouter;

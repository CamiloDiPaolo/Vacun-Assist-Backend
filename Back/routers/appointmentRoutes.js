const express = require("express");
const authController = require("../controllers/authController");
const appointmentController = require("../controllers/appointmentController");
const adminUtils = require("../controllers/adminUtils");
const vaccineAplication = require("../controllers/vaccineAplication");

const appointmentRouter = express.Router();

// sacar turno virtual
appointmentRouter
  .route("/virtual")
  .post(
    authController.protect,
    authController.restrictTo("user"),
    appointmentController.createAppointmentVirtual
  );

// sacar turno local
appointmentRouter
  .route("/local")
  .post(
    authController.protect,
    authController.restrictTo("vacc"),
    vaccineAplication.vaccineLocalAplication
  );

// validar turno
appointmentRouter
  .route("/validate")
  .post(
    authController.protect,
    authController.restrictTo("vacc"),
    appointmentController.validateAppointment
  );
// obtener datos de paciente
appointmentRouter
  .route("/get-user-appointments/:dni")
  .get(
    authController.protect,
    authController.restrictTo("vacc"),
    vaccineAplication.searchAppointments
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

// obtenemos las estadisticas
appointmentRouter
  .route("/stats")
  .get(
    authController.protect,
    authController.restrictTo("admin"),
    adminUtils.getStats
  );

appointmentRouter
  .route("/get-pendings")
  .get(
    authController.protect,
    authController.restrictTo("admin"),
    appointmentController.getPendingsAppointments
  );
module.exports = appointmentRouter;

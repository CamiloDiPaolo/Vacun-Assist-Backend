const Appointment = require("../models/appointmentModel");
const Stock = require("../models/stockModel");
const catchAsync = require("../utils/cathAsync");
const AppError = require("../utils/appError");
const appointmentUtils = require("./appointmentUtils");

exports.getStats = catchAsync(async (req, res, next) => {
  const allAppointments = await Appointment.find();
  // cantidad de turnos por vacuatorio
  // cantidad ed turnos por dia de semana
  // cantidad de turnos por facuna
  // cantidad total de turnos

  const vaccinationCenterStats = {
    "Hospital 9 de Julio": allAppointments.filter(
      (appointment) => appointment.vaccinationCenter == "Hospital 9 de Julio"
    ).length,
    Polideportivo: allAppointments.filter(
      (appointment) => appointment.vaccinationCenter == "Polideportivo"
    ).length,
    "Corralón Municipal": allAppointments.filter(
      (appointment) => appointment.vaccinationCenter == "Corralón Municipal"
    ).length,
    Externo: allAppointments.filter(
      (appointment) => appointment.vaccinationCenter == "Externo"
    ).length,
  };

  const vaccineStats = {
    Covid: allAppointments.filter(
      (appointment) => appointment.vaccine == "Covid"
    ).length,
    Gripe: allAppointments.filter(
      (appointment) => appointment.vaccine == "Gripe"
    ).length,
    FiebreAmarilla: allAppointments.filter(
      (appointment) => appointment.vaccine == "FiebreAmarilla"
    ).length,
  };

  allAppointments.filter((appointment) =>
    console.log(appointment.vaccinationDate.toString().split(" ")[0])
  );

  console.log();

  const daysStats = {
    Monday: allAppointments.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Mon"
    ).length,
    Tuesday: allAppointments.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Tue"
    ).length,
    Wednesday: allAppointments.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Wed"
    ).length,
    Thursday: allAppointments.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Thu"
    ).length,
    Friday: allAppointments.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Fri"
    ).length,
    Saturday: allAppointments.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Sat"
    ).length,
    Sunday: allAppointments.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Sun"
    ).length,
  };

  res.status(200).json({
    status: "success",
    stats: {
      vaccinationCenterStats,
      vaccineStats,
      daysStats,
      totalAppointment: allAppointments.length,
    },
  });
});

exports.addStock = catchAsync(async (req, res, next) => {
  const stock = await Stock.findOne({
    vaccine: req.body.vaccine,
    vaccinationCenter: req.body.vaccinationCenter,
  });

  const newStock = await Stock.findByIdAndUpdate(stock._id, {
    cant: stock.cant + req.body.cant,
  });

  res.status(200).json({
    status: "success",
    data: newStock,
  });
});

exports.subStock = catchAsync(async (req, res, next) => {
  const stock = await Stock.findOne({
    vaccine: req.body.vaccine,
    vaccinationCenter: req.body.vaccinationCenter,
  });

  const newStock = await Stock.findByIdAndUpdate(stock._id, {
    cant: stock.cant - 1,
  });

  res.status(200).json({
    status: "success",
    data: newStock,
  });
});

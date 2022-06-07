const catchAsync = require("./../utils/cathAsync");
const AppError = require("./../utils/appError");
const Appointment = require("./../models/appointmentModel");
const appointmentUtils = require("./appointmentUtils");
const MAX_COVID_DOSIS = 4;

exports.vaccineAplication = catchAsync(async (req, res, next) => {
  if (!req.body.vaccine || !req.body.vaccinationDate)
    return next(new AppError("No ingresaste todos los datos", 400));

  req.body.patientDni = req.user.dni;
  req.body.state = "Finalizado";
  req.body.vaccinationCenter = "Externo";

  // si el usuario ya tiene un turno activo contra la vacuna se debe ver si cancelarlo o no
  if (
    await isCancelable(
      req.user.dni,
      req.body.vaccine,
      new Date(req.body.vaccinationDate)
    )
  ) {
    appointmentUtils.cancelActiveAppointments(req.user.dni, req.body.vaccine);
  }

  console.log(
    "TIENE TURNOS ACTIVOS: ",
    await appointmentUtils.hasActiveAppointment(req.user.dni, req.body.vaccine)
  );

  const newAppointment = await Appointment.create(req.body);

  res.status(200).json({
    status: "success",
    data: newAppointment,
  });
});

const isCancelable = async (dni, vaccine, vaccineDate) => {
  // si no tiene turnos activos no se puede cancelar equisde
  if ((await appointmentUtils.hasActiveAppointment(dni, vaccine)) == 0)
    return false;

  if (vaccine == "FiebreAmarilla")
    // si la vacuna es fiebre amarilla cancelamos cualquier turno que tenga
    return true;

  const activeAppointment = await appointmentUtils.getActiveAppointment(
    dni,
    vaccine
  );

  const diffTime =
    activeAppointment.vaccinationDate.getTime() - vaccineDate.getTime();

  console.log(
    diffTime / (1000 * 60 * 60 * 24),
    diffTime / (1000 * 60 * 60 * 24) < 365,
    vaccine == "Gripe" && diffTime / (1000 * 60 * 60 * 24) < 365
  );

  // si la diferencia es menor a 3 meses se cancela los turnos de covid
  if (vaccine == "Covid" && diffTime / (1000 * 60 * 60 * 24) < 90) return true;

  // si con la nueva vacuna se completan las 4 dosis de covid
  if (
    vaccine == "Covid" &&
    appointmentUtils.hasAppointment(dni, vaccine) >= MAX_COVID_DOSIS
  )
    return true;

  // si la diferencia es menor a 1 año se cancela los turnos de gripe
  if (vaccine == "Gripe" && diffTime / (1000 * 60 * 60 * 24) < 365) return true;

  console.log("no se cancela");

  // si no pasa nada raro no se cancelan los turnos
  return false;
};

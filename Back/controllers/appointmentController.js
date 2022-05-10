const Appointment = require("../models/appointmentModel");
const userController = require("./userController");
const catchAsync = require("../utils/cathAsync");

exports.createAppointmentVirtual = catchAsync(async (req, res, next) => {
  // si el usuario ya esta vacunado contra esa vacuna no se permite sacar el turno
  const err = await appointmentValidation(req.user.dni, req.body.vaccine);
  if (err) return next(new Error(err));

  // si esta todo correcto se sigue
  req.body.patientDni = req.user.dni;

  // POR AHORA HARDCODEAMOS LA FECHA DEL TURNO; DESPUES TIENE QUE HACERSE BIEN
  let fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  req.body.vaccinationDate = fecha;

  const newAppointment = await Appointment.create(req.body);

  res.status(201).json({
    status: "success",
    data: { newAppointment },
  });
});

exports.createAppointmentLocal = catchAsync(async (req, res, next) => {
  // chequeo si existe en el renaper
  if (!(await userController.validRenaper(req.body.dni))) {
    return next(new Error("El usuario no es valido para la API del renaper"));
  }
  // corroboro que pueda darse el turno a la vacuna
  const err = await appointmentValidation(req.body.dni, req.body.vaccine);
  if (err) return next(new Error(err));

  //asignamos el centro de vacunacion del vacunador que esta logeado
  req.body.vaccinationCenter = req.user.vaccinationCenter;
  req.body.patientDni = req.body.dni;

  // POR AHORA HARDCODEAMOS LA FECHA DEL TURNO; DESPUES TIENE QUE HACERSE BIEN
  let fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  req.body.vaccinationDate = fecha;

  const newAppointment = await Appointment.create(req.body);

  res.status(200).json({
    status: "success",
    data: { newAppointment },
  });
});
const isVaccinated = async (dni, vac) => {
  const allAppointment = await Appointment.find({
    state: "Finalizado",
    vaccine: vac,
    patientDni: dni,
  });

  return allAppointment.length;
};
const hasAppointment = async (dni, vac) => {
  const allAppointment = await Appointment.find({
    $or: [{ state: "Finalizado" }, { state: "Activo" }],
    vaccine: vac,
    patientDni: dni,
  });

  return allAppointment.length;
};
const appointmentValidation = async (dni, vaccine) => {
  // si ya tiene un turno o se vacuno contra la vacuna
  if (await hasAppointment(dni, vaccine))
    return "Usted ya esta vacunado contra esa vacuna o tiene un turno pendiente contra la misma";
  // si se va a dar las vacunas de covid corroboramos que sea en orden
  if (!(await isVaccinated(dni, "Covid1")) && vaccine == "Covid2")
    return "No puede darse la 2da dosis sin antes darse la primera";
  if (!(await isVaccinated(dni, "Covid2")) && vaccine == "Covid3")
    return "No puede darse la 3ra dosis sin antes darse la segunda";

  return "";
};

exports.getAppointments = catchAsync(async (req, res, next) => {
  const queryOptions = {};

  if (req.user.rol == "user") queryOptions.patientDni = req.user.dni;
  if (req.user.rol == "vacc")
    queryOptions.vaccinationCenter = req.user.vaccinationCenter;

  console.log(req.user.dni);

  const appointments = await Appointment.find(queryOptions);

  res.status(200).json({
    status: "success",
    data: { appointments },
  });
});

const Appointment = require("../models/appointmentModel");
const userController = require("./userController");
const catchAsync = require("../utils/cathAsync");
const AppError = require("../utils/appError");

exports.createAppointmentVirtual = catchAsync(async (req, res, next) => {
  // si el usuario ya esta vacunado contra esa vacuna no se permite sacar el turno
  const err = await appointmentValidation(
    req.user.dni,
    req.body.vaccine,
    req.user.birthday
  );
  if (err) return next(new AppError(err, 500));

  // si esta todo correcto se sigue
  req.body.patientDni = req.user.dni;

  // POR AHORA HARDCODEAMOS LA FECHA DEL TURNO; DESPUES TIENE QUE HACERSE BIEN
  // let fecha = new Date();
  // fecha.setDate(fecha.getDate() + 1);
  // req.body.vaccinationDate = fecha;

  req.body.vaccinationDate = getAppointmentDate(
    req.user.birthday,
    req.body.vaccine,
    true
  );

  const newAppointment = await Appointment.create(req.body);

  res.status(201).json({
    status: "success",
    data: { newAppointment },
  });
});

exports.createAppointmentLocal = catchAsync(async (req, res, next) => {
  // chequeo si existe en el renaper
  if (!(await userController.validRenaper(req.body.dni))) {
    return next(
      new AppError("El usuario no es valido para la API del renaper"),
      403
    );
  }
  // corroboro que pueda darse el turno a la vacuna
  const err = await appointmentValidation(
    req.body.dni,
    req.body.vaccine,
    req.user.birthday
  );
  if (err) return next(new new AppError(err)(), 401);

  // comprobamos que se ingrese una fecha, ya que el vacunador la ingresa a mano
  if (!req.body.vaccinationDate)
    return next(
      new AppError(
        "Debe ingresar una fecha para sacar el turno de forma local",
        400
      )
    );

  //asignamos el centro de vacunacion del vacunador que esta logeado
  req.body.vaccinationCenter = req.user.vaccinationCenter;
  req.body.patientDni = req.body.dni;

  const newAppointment = await Appointment.create(req.body);

  res.status(200).json({
    status: "success",
    data: { newAppointment },
  });
});

exports.getAppointments = catchAsync(async (req, res, next) => {
  const queryOptions = {};

  if (req.user.rol == "user") queryOptions.patientDni = req.user.dni;
  if (req.user.rol == "vacc") {
    queryOptions.vaccinationCenter = req.user.vaccinationCenter;
    queryOptions.vaccinationDate = new Date().toDateString();
  }

  console.log(queryOptions);

  // console.log(req.user.dni);
  // 2022-05-12T16:59:21.354+00:00
  // console.log(queryOptions.vaccinationDate);
  // console.log(new Date().toDateString());

  const appointments = await Appointment.find(queryOptions);

  res.status(200).json({
    status: "success",
    data: { appointments },
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
const appointmentValidation = async (dni, vaccine, birthday) => {
  const birthdayDate = new Date(birthday);
  const currentDate = new Date();
  let age = currentDate.getFullYear() - birthdayDate.getFullYear();
  age = birthdayDate.getMonth() < currentDate.getMonth() ? age : age - 1;
  // si ya tiene un turno o se vacuno contra la vacuna
  if (await hasAppointment(dni, vaccine))
    return "Usted ya esta vacunado contra esa vacuna o tiene un turno pendiente contra la misma";
  // si se va a dar las vacunas de covid corroboramos que sea en orden
  if (!(await isVaccinated(dni, "Covid1")) && vaccine == "Covid2")
    return "No puede darse la 2da dosis sin antes darse la primera";
  if (!(await isVaccinated(dni, "Covid2")) && vaccine == "Covid3")
    return "No puede darse la 3ra dosis sin antes darse la segunda";
  if (age < 18 && vaccine.startsWith("Covid"))
    return "No puede darse la vacuan contra el Covid si es menor de age";
  if (age > 60 && vaccine == "FiebreAmarilla")
    return "Es demasiado mayor para aplicarse esa vacuna";
  else if (vaccine == "FiebreAmarilla")
    return "El turno para la fiebre amarilla debe sacarse de forma local";
  return "";
};

const getAppointmentDate = (birthday, vaccine, isRisk) => {
  const birthdayDate = new Date(birthday);
  const currentDate = new Date();
  let age = currentDate.getFullYear() - birthdayDate.getFullYear();
  age = birthdayDate.getMonth() < currentDate.getMonth() ? age : age - 1;

  // prueba para obtener probar el tema de los turnos
  // return currentDate.toDateString();

  // condiciones para la Gripe
  if ((age < 18 || age < 60) && vaccine === "Gripe") {
    currentDate.setUTCMonth(currentDate.getMonth() + 6);
    return currentDate.toDateString();
  } else if (vaccine === "Gripe") {
    currentDate.setUTCMonth(currentDate.getMonth() + 3);
    return currentDate.toDateString();
  }

  // condiciones para el Covid
  if (age > 60 && vaccine.startsWith("Covid")) {
    currentDate.setUTCDate(currentDate.getDate() + 7);
    return currentDate.toDateString();
  } else if (isRisk && vaccine.startsWith("Covid")) {
    currentDate.setUTCDate(currentDate.getDate() + 7);
    return currentDate.toDateString();
  } else if (vaccine.startsWith("Covid")) {
    throw new AppError(
      "Si no sos de riesgo tenes que sacar el turno local...",
      403
    );
  }
  throw new AppError("Algo salio mal a asignar el turno....", 500);
};

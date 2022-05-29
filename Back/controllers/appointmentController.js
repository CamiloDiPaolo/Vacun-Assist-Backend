const Appointment = require("../models/appointmentModel");
const userController = require("./userController");
const catchAsync = require("../utils/cathAsync");
const AppError = require("../utils/appError");

const MAX_COVID_DOSIS = 4;

exports.createAppointmentVirtual = catchAsync(async (req, res, next) => {
  if (!req.body.vaccine)
    return next(
      new AppError("Tenes que ingresar una vacuna para solicitar un turno"),
      400
    );
  if (!req.body.vaccinationCenter)
    return next(
      new AppError(
        "Tenes que ingresar una centro de vacunacion para solicitar un turno"
      ),
      400
    );
  if (!req.user.updatedHealthData)
    return next(
      new AppError(
        "Tenes que completar tus datos de salud para poder sacar un turno"
      ),
      403
    );

  // si el usuario ya esta vacunado contra esa vacuna no se permite sacar el turno
  const err = await appointmentValidation(
    req.user.dni,
    req.body.vaccine,
    req.user.birthday
  );
  if (err && err != "Pendiente") return next(new AppError(err, 500));

  let vaccinationDate = await getAppointmentDate(
    req.user.birthday,
    req.body.vaccine,
    req.user.isRisk,
    req.user.dni
  );

  // si no cumple con los requisitos el turno queda a la espera para ser aprobado
  req.body.state =
    err == "Pendiente" || vaccinationDate == "Pendiente"
      ? "Pendiente"
      : "Activo";

  if (vaccinationDate != "Pendiente")
    req.body.vaccinationDate = vaccinationDate;

  // si esta todo correcto se sigue
  req.body.patientDni = req.user.dni;
  const newAppointment = await Appointment.create(req.body);

  res.status(201).json({
    status: "success",
    data: { newAppointment },
  });
});

// exports.createAppointmentLocal = catchAsync(async (req, res, next) => {
//   // chequeo si existe en el renaper
//   if (!(await userController.validRenaper(req.body.dni))) {
//     return next(
//       new AppError("El usuario no es valido para la API del renaper"),
//       403
//     );
//   }
//   // corroboro que pueda darse el turno a la vacuna
//   const err = await appointmentValidation(
//     req.body.dni,
//     req.body.vaccine,
//     req.user.birthday
//   );
//   if (err) return next(new new AppError(err)(), 401);

//   // comprobamos que se ingrese una fecha, ya que el vacunador la ingresa a mano
//   if (!req.body.vaccinationDate)
//     return next(
//       new AppError(
//         "Debe ingresar una fecha para sacar el turno de forma local",
//         400
//       )
//     );

//   //asignamos el centro de vacunacion del vacunador que esta logeado
//   req.body.vaccinationCenter = req.user.vaccinationCenter;
//   req.body.patientDni = req.body.dni;

//   const newAppointment = await Appointment.create(req.body);

//   res.status(200).json({
//     status: "success",
//     data: { newAppointment },
//   });
// });

exports.getAppointments = catchAsync(async (req, res, next) => {
  const queryOptions = {};

  if (req.user.rol == "user") queryOptions.patientDni = req.user.dni;
  if (req.user.rol == "vacc") {
    queryOptions.vaccinationCenter = req.user.vaccinationCenter;
    queryOptions.vaccinationDate = new Date();
    queryOptions.vaccinationDate.setHours(0);
    queryOptions.vaccinationDate.setMinutes(0);
    queryOptions.vaccinationDate.setSeconds(0);
    queryOptions.vaccinationDate.setMilliseconds(0);
  }

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
const hasActiveAppointment = async (dni, vac) => {
  const allAppointment = await Appointment.find({
    $or: [{ state: "Pendiente" }, { state: "Activo" }],
    vaccine: vac,
    patientDni: dni,
  });

  return allAppointment.length;
};
const lastAppointmentMonth = async (dni, vac) => {
  const allAppointment = await Appointment.find({
    state: "Finalizado",
    vaccine: vac,
    patientDni: dni,
  });

  if (allAppointment.length === 0) return 0;

  // Math.min.apply(Math, nums);
  const lastDateTime = Math.max.apply(
    Math,
    allAppointment.map((appointment) =>
      new Date(appointment.vaccinationDate).getTime()
    )
  );
  const lastAppointment = allAppointment.find(
    (appointment) =>
      new Date(appointment.vaccinationDate).getTime() === lastDateTime
  );

  // comprobamos la cantidad de meses pedazo NOTAS
  const currentDate = new Date();
  const lastAppointmentDate = new Date(lastAppointment.vaccinationDate);

  let monthsDiff = (currentDate.getYear() - lastAppointmentDate.getYear()) * 12;
  monthsDiff += currentDate.getMonth();
  monthsDiff -= lastAppointmentDate.getMonth();
  return monthsDiff;
};
const appointmentValidation = async (dni, vaccine, birthday) => {
  const birthdayDate = new Date(birthday);
  const currentDate = new Date();
  let age = currentDate.getFullYear() - birthdayDate.getFullYear();
  age = birthdayDate.getMonth() < currentDate.getMonth() ? age : age - 1;

  // corroboramos la cantidad de turnos contra el covid que tiene
  if (
    vaccine == "Covid" &&
    (await hasAppointment(dni, vaccine)) >= MAX_COVID_DOSIS
  )
    return `No podes darte mas de ${MAX_COVID_DOSIS} vacunas contra el Covid 😅`;

  // si ya tiene un turno o se vacuno contra la vacuna
  if (await hasActiveAppointment(dni, vaccine))
    return "Ya tenes un turno contra esta vacuna o tenes un turno en espera 😅";

  // comprobamos los temas de la edad
  if (age < 18 && vaccine == "Covid")
    return "Por tu edad no podes vacunarte con esta vacuna😅";
  if (age > 60 && vaccine == "FiebreAmarilla")
    return "Por tu edad no podes vacunarte con esta vacuna😅";
  else if (vaccine == "FiebreAmarilla") return "Pendiente";

  // comprobamos la ultima dosis de cada vacuna
  if (
    vaccine == "Covid" &&
    (await lastAppointmentMonth(dni, vaccine)) < 3 &&
    (await hasAppointment(dni, vaccine)) >= 1
  )
    return "Tenes que esperar a que pasen mas de 3 meses de la ultima dosis para sacar turno 🤔";
  if (
    vaccine == "Gripe" &&
    (await lastAppointmentMonth(dni, vaccine)) < 12 &&
    (await hasAppointment(dni, vaccine)) >= 1
  )
    return "Tenes que esperar a que pasen mas de 12 meses de la ultima dosis para sacar turno 🤔";

  return "";
};

const getAppointmentDate = async (birthday, vaccine, isRisk, dni) => {
  const birthdayDate = new Date(birthday);
  const currentDate = new Date();

  currentDate.setHours(0);
  currentDate.setMinutes(0);
  currentDate.setSeconds(0);
  currentDate.setMilliseconds(0);

  let age = currentDate.getFullYear() - birthdayDate.getFullYear();
  age = birthdayDate.getMonth() < currentDate.getMonth() ? age : age - 1;

  // condiciones para la Gripe
  if (vaccine === "Gripe") {
    if ((age < 18 || age < 60) && vaccine === "Gripe") {
      currentDate.setUTCMonth(currentDate.getMonth() + 6);
      return currentDate;
    }

    currentDate.setUTCMonth(currentDate.getMonth() + 3);
    return currentDate;
  }

  // condiciones para el Covid

  if (vaccine == "Covid") {
    // console.log(lastAppointmentMonth(dni, vaccine));
    if (age > 60) {
      currentDate.setUTCDate(currentDate.getDate() + 7);
      return currentDate;
    }
    if (age > 18 && age < 60 && isRisk) {
      currentDate.setUTCDate(currentDate.getDate() + 7);
      return currentDate;
    }
    if (
      age > 18 &&
      age < 60 &&
      !isRisk &&
      (await lastAppointmentMonth(dni, vaccine)) >= 3
    ) {
      currentDate.setUTCDate(currentDate.getDate() + 7);
      return currentDate;
    }
    return "Pendiente";
  }

  throw new AppError("Algo salio mal a asignar el turno....", 500);
};

exports.validateAppointment = catchAsync(async (req, res, next) => {
  let appointment = await Appointment.findById(req.body.id);

  if (!appointment)
    throw new AppError(
      "No se encontro un turno que coincida con los datos ",
      400
    );
  if (["Finalizado", "Cancelado"].includes(appointment.state))
    throw new AppError("El turno no puede cambiar de estado", 400);

  if (!["Finalizado", "Cancelado"].includes(req.body.state))
    throw new AppError("El estado debe ser solo Finalizado o Cancelado", 400);

  if (!req.body.lot)
    throw new AppError("No se ingreso el lote de la vacuna", 400);
  if (!req.body.mark)
    throw new AppError("No se ingreso la marca de la vacuna", 400);

  appointment.state = req.body.state;
  appointment.lot = req.body.lot;
  appointment.mark = req.body.mark;

  await Appointment.findByIdAndUpdate(appointment.id, appointment);

  // una vez que se valida correctamente el turno se crea uno nuevo dependiendo el tipo de vacuna
  const vaccine = appointment.vaccine;
  if (!(vaccine == "FiebreAmarilla")) {
    const newDate = new Date();
    newDate.setHours(0);
    newDate.setMinutes(0);
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);

    // si la vacuna es gripe el turno se da a un año, si es covid a 3 meses
    if (vaccine == "Covid") newDate.setUTCMonth(newDate.getMonth() + 3);
    else newDate.setUTCFullYear(newDate.getFullYear() + 1);

    // eliminamos los campos para que crea mongoose para no tener problemas al crear uno nuevo
    const newAppointment = {
      state: "Activo",
      patientDni: appointment.patientDni,
      vaccine: appointment.vaccine,
      vaccinationDate: newDate,
      issueDate: new Date(),
      vaccinationCenter: appointment.vaccinationCenter,
    };
    appointment = await Appointment.create(newAppointment);
  }

  res.status(200).json({
    status: "success",
    data: {
      appointment,
    },
  });
});

exports.cancelAppointment = catchAsync(async (req, res, next) => {
  if (!req.body.id)
    return next(
      new AppError("Debe ingresar una id para eliminar el turno..", 400)
    );
  if (req.body.id.length != 24)
    return next(
      new AppError("El formato de id que ingresaste es incorrecto..", 400)
    );

  const appointment = await Appointment.findOne({
    patientDni: req.user.dni,
    _id: req.body.id,
  });

  if (!appointment) return next(new AppError("no se encontro un turno..", 400));

  if (appointment.state != "Activo")
    return next(
      new AppError("no podes cancelar un turno que no este activo..", 400)
    );
  appointment.state = "Cancelado";
  appointment.vaccinationDate = "Cancelado";

  await Appointment.findByIdAndUpdate(appointment.id, appointment);

  console.log(appointment);
  res.status(200).json({
    status: "success",
    data: {
      appointment,
    },
  });
});

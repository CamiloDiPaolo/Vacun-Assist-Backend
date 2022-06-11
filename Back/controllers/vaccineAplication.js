const catchAsync = require("./../utils/cathAsync");
const AppError = require("./../utils/appError");
const Appointment = require("./../models/appointmentModel");
const User = require("./../models/userModel");
const userController = require("./userController");
const appointmentController = require("./appointmentController");
const appointmentUtils = require("./appointmentUtils");
const authController = require("./authController");
const sendMail = require("../utils/email");
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
  // si no pasa nada raro no se cancelan los turnos
  return false;
};

exports.searchAppointments = catchAsync(async (req, res, next) => {
  const patient = await User.findOne({ dni: req.params.dni });

  // si el dni esta registrado devolvemos sus turnos
  if (patient) {
    return res.status(200).json({
      status: "success",
      data: await Appointment.find({ patientDni: patient.dni }),
    });
  }

  // si el dni no esta registrado  validamos con el renaper
  const user = await userController.userRenaperNoValid({ dni: req.params.dni });

  res.status(200).json({
    status: "success",
    data: user,
  });
});

exports.vaccineLocalAplication = catchAsync(async (req, res, next) => {
  if (!availability(req.body.vaccine))
    return next(new AppError("No hay disponibilidad para esta vacuna 😥", 403));

  const patient = await User.findOne({ dni: req.body.dni });
  if (!req.body.birthday) {
    return next(new AppError("falto ingresar el cumple", 404));
  }
  if (!req.body.email) {
    return next(new AppError("falto ingresar el mail", 404));
  }

  // si el usuario ya esta vacunado contra esa vacuna no se permite sacar el turno
  const err = await appointmentValidation(
    req.body.dni,
    req.body.vaccine,
    req.body.birthday
  );
  if (err) return next(new AppError(err, 500));

  const newAppointments = await appointmentController.createAppointmentLocal({
    vaccine: req.body.vaccine,
    vaccinationCenter: req.user.vaccinationCenter,
    lot: req.body.lot,
    mark: req.body.mark,
    patientDni: req.body.dni,
  });

  // si ya esta registrado el paciente solo devolvemos los turnos nuevos
  if (patient) {
    return res.status(201).json({
      status: "success",
      data: {
        newAppointments,
      },
    });
  }

  // si todo sale OC registro al usuario en el sistema y le envio su codigo y contraseña por mail

  const userData = await userController.userRenaperNoValid({
    dni: req.body.dni,
  });
  (userData.rol = "user"),
    (userData.password = authController.randomPassword());
  userData.code = authController.randomCode();
  userData.email = req.body.email;

  const newUser = await User.create(userData);

  sendMail({
    message: `Tu contraseña es: ${userData.password} y tu codigo es: ${userData.code}`,
    email: req.body.email,
  });

  res.status(201).json({
    status: "success",
    data: {
      appointments: newAppointments,
      user: newUser,
    },
  });
});

const availability = (vaccine) => {
  return true;
};

const appointmentValidation = async (dni, vaccine, birthday) => {
  const birthdayDate = new Date(birthday);
  const currentDate = new Date();
  let age = currentDate.getFullYear() - birthdayDate.getFullYear();
  age = birthdayDate.getMonth() < currentDate.getMonth() ? age : age - 1;

  // corroboramos la cantidad de turnos contra el covid que tiene
  if (
    vaccine == "Covid" &&
    (await appointmentUtils.hasAppointment(dni, vaccine)) >= MAX_COVID_DOSIS
  )
    return `El usuario ya tiene ${MAX_COVID_DOSIS} dosis aplicadas 😅`;
  if (vaccine == "FiebreAmarilla" && (await hasAppointment(dni, vaccine)) > 0)
    return `El usuario ya tiene la dosis aplicada 😅`;
  // comprobamos los temas de la edad
  if (age < 18 && vaccine == "Covid")
    return "Por tu edad no podes vacunarte con esta vacuna😅";
  if (age > 60 && vaccine == "FiebreAmarilla")
    return "Por tu edad no podes vacunarte con esta vacuna😅";
  if (
    vaccine == "Covid" &&
    (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) < 3 &&
    (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) != null
  )
    return "El usuario tiene que esperar mínimo 3 meses desde su ultima aplicación para vacunarse nuevamente 😅";
  if (
    vaccine == "Gripe" &&
    (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) < 12 &&
    (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) != null
  )
    return "El usuario tiene que esperar mínimo 1 año desde su ultima aplicación para vacunarse nuevamente 😅";
  return "";
};

const Appointment = require("../models/appointmentModel");
const User = require("../models/userModel");
const Stock = require("../models/stockModel");
const catchAsync = require("../utils/cathAsync");
const AppError = require("../utils/appError");
const authController = require("./authController");
const userController = require("./userController");
const sendMail = require("../utils/email");
const cathAsync = require("../utils/cathAsync");

exports.getStats = catchAsync(async (req, res, next) => {
  let allAppointments = await Appointment.find();
  if (req.body.date1 && req.body.date2) {
    console.log(req.body);
    const date1 = new Date(req.body.date1).getTime();
    const date2 = new Date(req.body.date2).getTime();
    console.log(date1, date2);
    allAppointments = allAppointments.filter((appointment) => {
      return (
        appointment.vaccinationDate.getTime() <= date2 &&
        appointment.vaccinationDate.getTime() >= date1
      );
    });
  }
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
      (appointment) => appointment.vaccinationCenter == "Corralón municipal"
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

  const allAppointmentsWithoutPendientes = allAppointments.filter(
    (appointment) => appointment.state !== "Pendiente"
  );
  const daysStats = {
    Lunes: allAppointmentsWithoutPendientes.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Mon"
    ).length,
    Martes: allAppointmentsWithoutPendientes.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Tue"
    ).length,
    Miercoles: allAppointmentsWithoutPendientes.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Wed"
    ).length,
    Jueves: allAppointmentsWithoutPendientes.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Thu"
    ).length,
    Viernes: allAppointmentsWithoutPendientes.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Fri"
    ).length,
    Sabado: allAppointmentsWithoutPendientes.filter(
      (appointment) =>
        appointment.vaccinationDate.toString().split(" ")[0] == "Sat"
    ).length,
    Domingo: allAppointmentsWithoutPendientes.filter(
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
    cant: stock.cant + Number(req.body.cant),
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

exports.getStock = cathAsync(async (req, res, next) => {
  const stock = await Stock.findOne({
    vaccine: req.body.vaccine,
    vaccinationCenter: req.body.vaccinationCenter,
  });
  res.status(200).json({
    status: "success",
    data: stock,
  });
});

exports.signupVacc = catchAsync(async (req, res, next) => {
  // comprobamso que se ingresen todos los datos
  if (!req.body.dni || !req.body.email)
    return next(new AppError("Por favor ingresa todos los datos", 400));
  // verificamos que no exista alguien conese dni
  const user = await User.find({ dni: req.body.dni, rol: "vacc" });
  if (user.length)
    return next(new AppError("El DNI ingresado ya está registrado.", 400));

  if (!req.body.vaccinationCenter)
    return next(
      new AppError(
        "Un vacunador debe tener asignado un centro de vacunacion",
        400
      )
    );

  req.body.password = randomPassword();
  req.body.code = randomCode();
  req.body.rol = "vacc";

  sendMail({
    message: `Tu contraseña es: ${req.body.password} y tu codigo es: ${req.body.code}`,
    email: req.body.email,
  });

  const dataNewUser = await userController.userRenaperNoValid(req.body);

  const userNoVacc = await User.findOne({ dni: req.body.dni });
  if (userNoVacc) await User.findByIdAndDelete(userNoVacc._id);

  const newUser = await User.create(dataNewUser);

  res.status(201).json({
    status: "seccess",
    data: newUser,
  });
});
exports.getUserRenaper = catchAsync(async (req, res, next) => {
  const user = await userController.userRenaperNoValid({ dni: req.params.dni });

  res.status(200).json({
    status: "success",
    data: user,
  });
});

exports.assingPendingAppointments = catchAsync(async (req, res, next) => {
  // recibe una vacuna y una cantidad de turnos a asignar
  if (!req.body.vaccine || !req.body.cant || !req.body.date)
    return next(
      new AppError("No ingresaste la vacuna o la cantidad de turnos", 400)
    );

  // obtenemos todos los turnos y ordenamos por fecha
  const allAppointments = await Appointment.find({
    vaccine: req.body.vaccine,
    state: "Pendiente",
  });

  allAppointments.sort((app1, app2) => {
    return (
      new Date(app2.vaccinationDate).getTime() -
      new Date(app1.vaccinationDate).getTime()
    );
  });

  // actualizamos los turnos pendientes
  const newDate = new Date(req.body.date);
  const currentDate = new Date();

  newDate.setHours(1);
  newDate.setMinutes(0);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);

  currentDate.setHours(1);
  currentDate.setMinutes(0);
  currentDate.setSeconds(0);
  currentDate.setMilliseconds(0);

  //si la fecha que se selecciono es menor a 7 dias da error
  if (newDate.getTime() - currentDate.getTime() < 1000 * 60 * 60 * 24 * 7)
    return next(
      new AppError(
        "Los turnos solo pueden ser habilitados para dentro de 7 días en adelante 😓",
        400
      )
    );

  const newAppointments = allAppointments.slice(0, req.body.cant);

  // actualizamos todos los turnos pendientes
  await Promise.all(
    newAppointments.map(async (appointment, i) => {
      if (i === req.body.cant) return;
      return await Appointment.findByIdAndUpdate(appointment._id, {
        vaccinationDate: newDate,
        state: "Activo",
      });
    })
  );
  res.status(200).json({
    status: "success",
    data: allAppointments.slice(0, req.body.cant),
  });
});

const randomPassword = () => {
  // hay que mejorar esto
  return "12345678";
};

const randomCode = () => {
  // hay que mejorar esto
  let code = (Math.random() * 10000).toFixed(0);
  code = code < 1000 ? 1001 : code;
  code = code == 10000 ? 9999 : code; // seria gracioso que justo justo sea 10000, osea es una probabilidad re chica alta mala leche tenia si justo pasaba esto en la demo jajaja igual ni idea pq escribo este comentario tan largo si nadie lo va a leer en fin aguante la fafafa
  // return code;
  return 1234; // por ahora retorno esto para probar
};

const express = require("express");
// modulo para conectar la aplicacion con MongoDB
const mongoose = require("mongoose");
// modulo para formatear las cookies y que aparezcan en formato json
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

// modulos creados por mi
const userRouter = require("./routers/userRoutes");
const appointmentRouter = require("./routers/appointmentRoutes");
const adminRouter = require("./routers/adminRoutes");
const { PORT, ALLOWED_ACCES_URL } = require("./config");
const Appointment = require("./models/appointmentModel");
const { sendMessage: sendTelegramMessage } = require("./utils/telegramBot");
const sendMail = require("./utils/email");
const User = require("./models/userModel");

// creamos la app express
const app = express();
app.use(express.json());
app.use(cookieParser()); // aplicamos la middleware para formatear las cookies
// app.use(cors({ origin: "http://localhost:3001" }));
app.use(morgan());

/// middlewares para aceptar el manejo de cookies
app.use((req, res, next) => {
  // ALLOWED_ACCES_URL[0] para probar cosa del FRONT
  // ALLOWED_ACCES_URL[1] para probar cosa del BACK
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ACCES_URL[0]);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  console.log("LLEGUE A CHEQUEAR EL CORS");
  next();
});

// middleware que se encarga de actualizar los turnos perdidos
(async () => {
  const allAppointments = await Appointment.find({});
  const currentDate = new Date();

  currentDate.setHours(0);
  currentDate.setMinutes(0);
  currentDate.setSeconds(0);
  currentDate.setMilliseconds(0);

  allAppointments.forEach(async (appointment) => {
    const appointmentDate = new Date(appointment.vaccinationDate);
    if (
      appointment.state == "Activo" &&
      appointmentDate.getTime() < currentDate.getTime()
    ) {
      await Appointment.findByIdAndUpdate(appointment._id, {
        state: "Perdido",
      });
    }
  });
})();

// middleware para enviar notificaciones por mail
// middleware que se encarga de actualizar los turnos perdidos
// el intervalo para notificar se ejecuta  cada dia a las 11hs(actualmente esta configurado cada 10min)
setInterval(async () => {
  const hour = new Date().getHours();
  if (hour != 18) return;
  const allAppointments = await Appointment.find({ state: "Activo" });
  const currentDate = new Date();

  currentDate.setHours(0);
  currentDate.setMinutes(0);
  currentDate.setSeconds(0);
  currentDate.setMilliseconds(0);

  allAppointments.forEach(async (appointment) => {
    const date = new Date(appointment.vaccinationDate);
    const diff =
      (date.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);

    if (Math.trunc(diff) > 1 || diff < 0) return;

    const user = await User.findOne({ dni: appointment.patientDni + "" });

    // enviamos el token por mail
    sendMail({
      message: `Tenes un turno para la vacuna contra ${appointment.vaccine} mañana en el vacunatorio ${appointment.vaccinationCenter}`,
      email: user.email,
    });

    // Enviamos un mensaje por telegram si esta suscrito
    const telegramUser = await User.findOne({
      dni: appointment.patientDni,
      telegramSuscribe: true,
    });
    if (telegramUser && telegramUser.telegramID) {
      await sendTelegramMessage(telegramUser.telegramID, appointment);
    }
  });
}, 1000 * 60 * 35);

/////////////////////////////////////////////
// nos conectamos con la base de datos
// NOTA: esto tiene que estar en las variables de entorno, junto con la contra del admin
const DB = "mongodb://127.0.0.1:27017/vacunAsist";

mongoose
  .connect(DB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("La conexion con la base de datos fue exitosa");
  });

/////////////////////////////////////////////

const router = express.Router();

// manejo de rutas
// NOTA: mas adelante crear un modulo especial para las rutas
router.route("/").get((req, res, next) => {
  res.send("aca va todo lo que tienen q hacer uada y joacko");
});

// asignamos el enrutador a la ruta basica
app.use("/", router);
app.use("/users", userRouter);
app.use("/appointment", appointmentRouter);
app.use("/admin", adminRouter);

// manejador de errores global
app.use((err, req, res, next) => {
  console.log(err.statusCode);
  res.status(err.statusCode || 500).json({
    status: "fail",
    message:
      err.message ||
      "Ocurrio un error en el servidor... volve a intentar nuevamente",
  });
});

// levantamos el servidor
const server = app.listen(PORT, () => {
  console.log("El servidor esta arriba");
});

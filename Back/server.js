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
    if (
      appointment.state == "Activo" &&
      appointment.vaccinationDate.getTime() < currentDate.getTime()
    ) {
      await Appointment.findByIdAndUpdate(appointment._id, {
        state: "Perdido",
      });
    }
  });
})();

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

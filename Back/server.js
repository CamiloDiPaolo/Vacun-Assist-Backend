const express = require("express");
// modulo para conectar la aplicacion con MongoDB
const mongoose = require("mongoose");
// modulo para formatear las cookies y que aparezcan en formato json
const cookieParser = require("cookie-parser");

const cors = require("cors");
const morgan = require("morgan");

// modulos creados por mi
const userRouter = require("./routers/userRoutes");
const appointmentRouter = require("./routers/appointmentRoutes");

// creamos la app express
const app = express();
app.use(express.json());
app.use(cookieParser()); // aplicamos la middleware para formatear las cookies
// app.use(cors({ origin: "http://localhost:3001" }));
app.use(morgan());

/// middlewares para aceptar el manejo de cookies
app.use((req, res, next) => {
  // comentar alguno dependiendo el ambiente en el que se esta proban(front con react o postman)
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3001");
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:8082");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});

/////////////////////////////////////////////
// nos conectamos con la base de datos
// NOTA: esto tiene que estar en las variables de entorno, junto con la contra del admin
const DB = "mongodb://localhost:27017/vacunAsist";

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

// manejador de errores global
app.use((err, req, res, next) => {
  res.status(500).json({
    status: "fail",
    message: err.message,
  });
});

// levantamos el servidor
const server = app.listen(8082, () => {
  console.log("El servidor esta arriba");
});

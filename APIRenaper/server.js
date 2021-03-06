const express = require("express");
const fs = require("fs");
const util = require("util");
const morgan = require("morgan");
// uso esto hasta encontran como verga funciona bien
const cors = require("cors");

const app = express();
const router = express.Router();

app.use(express.json());
app.use(morgan());
app.use(cors());

router.route("/person/lookup").post((req, res, next) => {
  readRenaper(req, res, next);
});
router.route("/person/validate").post((req, res, next) => {
  validateRenaper(req, res, next);
});
// router.route("/:dni").get((req, res, next) => {
//   readRenaper2(req.params.dni, res, next);
// });

app.use("/", router);

app.use((err, req, res, next) => {
  res.status(500).json({
    status: "fail",
    message: "no se encontro el recurso",
  });
});

const server = app.listen(8000, () => {
  console.log("La API del RENAPER esta funcionando");
});

const readRenaper = async (req, res, next) => {
  const data = JSON.parse(
    await util.promisify(fs.readFile)("./data.json", "utf-8")
  );
  const user = data.find((e) => e.numeroDocumento === req.body.dni);
  if (!user) return next(new Error("no se encontro el recurso"));
  res.status(200).json({
    status: "success",
    data: user,
  });
};

const validateRenaper = async (req, res, next) => {
  const data = JSON.parse(
    await util.promisify(fs.readFile)("./data.json", "utf-8")
  );
  const user = data.find((e) => e.numeroDocumento === req.body.dni);
  if (!user) return next(new Error("no se encontro el recurso"));

  console.log(user);

  // Por ahora solo valido con el cuit, pero hay que mejorar la validacion
  if (!user.idPersona === "2043521062")
    return next(new Error("validacion incorrecta"));
  res.status(200).json({
    status: "success",
    data: user,
  });
};
// const readRenaper2 = async (dni, res, next) => {
//   const data = JSON.parse(
//     await util.promisify(fs.readFile)("./data.json", "utf-8")
//   );
//   const user = data.find((e) => e.numeroDocumento === dni);

//   if (!user) return next(new Error("no se encontro el recurso"));
//   res.status(200).json({
//     status: "success",
//     data: user,
//   });
// };

console.log(arguments);

const User = require("../models/userModel");
const catchAsync = require("../utils/cathAsync");
const AppError = require("../utils/appError");
// modulo usado para ahcer peticiones a la API de renaper
const axios = require("axios");
const { URL_RENAPER } = require("../config");

exports.createUser = catchAsync(async (req, res, next) => {
  const newUser = User.create(req.body);

  res.status(201).json({
    status: "success",
    data: {
      user: newUser,
    },
  });
});
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const allUser = await User.find();

  res.status(200).json({
    status: "success",
    data: {
      users: allUser,
    },
  });
});
exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ dni: req.params.dni });

  if (!user)
    return next(
      new AppError(
        `No se encontro al usuario con el dni: ${req.params.dni}`,
        404
      )
    );

  res.status(200).json({
    status: "success",
    data: user,
  });
});
exports.updateHealthData = catchAsync(async (req, res, next) => {
  // comprobamos que se hayan ingresado todos los datos
  const {
    isRisk,
    anyCovidVaccine,
    lastCovidVaccineDate,
    fluVaccineYear,
    yellowFeverVaccine,
  } = req.body;
  if (
    isRisk == undefined ||
    anyCovidVaccine == undefined ||
    lastCovidVaccineDate == undefined ||
    fluVaccineYear == undefined ||
    yellowFeverVaccine == undefined
  )
    return next(
      new AppError("Falto ingresar alguno de los datos de salud", 400)
    );

  // sie sta todo oc actualizamos los datos
  req.user.healthData = req.body;
  req.user.healthData.updatedData = true;

  await User.findByIdAndUpdate(req.user.id, req.user);

  res.status(201).json({
    status: "success",
    data: req.user,
  });
});
/**
 * Esta funcion retorna lso datos de una persona del renaper con el formato utilizado en la base de datos
 * @param {Object} usrData son los datos del usuario utilizados para el registro: dni, password, email y rol
 * @returns un objeto de usuario con todos los datos del renaper formateados, o tira un error si algo sale mal con la API
 */
exports.userRenaper = async (usrData) => {
  try {
    // objeto de configuracion axios
    const options = {
      url: "/",
      method: "get",
      baseURL: URL_RENAPER,
      headers: { "X-Requested-With": "XMLHttpRequest" },
      data: { dni: usrData.dni },
      // data: { dni: "43521062" },
      timeout: 5000,
    };
    // obtenemos los datos de la persona del renaper
    const resRenaper = await axios(options);
    const userEspañol = resRenaper.data.data;

    // chequeamos si se encontro a la persona
    if (!userEspañol) throw new AppError("No se encontro a la persona", 404);

    // si la persona es una persona juridica devolvemos un error
    if (userEspañol.tipoPersona === "JURIDICA")
      throw new AppError("Solo se aceptan personas fisicas", 401);

    // pasamos la data del usuario al formato de la base de datos
    const newUserData = dataFormat(userEspañol, usrData);

    return newUserData;
  } catch (err) {
    throw new AppError(
      `Ocurrio un error con la API de Renaper. El error fue: ${err}`,
      404
    );
  }
};
/**
 * Esta funcion retorna si un dni es valido para la API de renaper
 * @param {String} dni dni de la persona a validar
 */
exports.validRenaper = async (dni) => {
  try {
    const options = {
      url: "/",
      method: "get",
      baseURL: "http://localhost:8000/renaper",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      data: { dni },
      timeout: 5000,
    };
    const resRenaper = await axios(options);

    return resRenaper.data.data;
  } catch (err) {
    return new AppError("Hubo un problema con la API del renaper", 404);
  }
};
/**
 * Esta funcion formatea los datos de un objeto del renaper a un objeto compatible con la base de datos
 * @param {Object} usrEsp son los datos del usuario en el formato del renaper
 * @param {Object} usrEng son los datos del usuario que se alamacenaran en la base de datos
 * @returns el objeto usrEng con los datos agregados y formateados de usrEsp
 */
const dataFormat = (usrEsp, usrEng) => {
  // por los casos en los que se tiene todo el nombre en el apellido
  usrEng.fullName = `${usrEsp.nombre ? usrEsp.nombre : ""} ${usrEsp.apellido}`;
  usrEng.cuil = usrEsp.idPersona;
  usrEng.dni = usrEsp.numeroDocumento;

  if (usrEsp.domicilio instanceof Array) {
    // si la persona es monotributista tomamos el domicilio real
    usrEsp.domicilio = usrEsp.domicilio.find(
      (dom) => dom.tipoDomicilio === "LEGAL/REAL"
    );
    console.log("El domicilio es un arreglo");
  }

  usrEng.home = {
    street: usrEsp.domicilio.calle,
    postalCode: usrEsp.domicilio.codigoPostal,
    state: usrEsp.domicilio.descripcionProvincia,
    number: usrEsp.domicilio.numero,
  };
  usrEng.birthday = usrEsp.fechaNacimiento;

  return usrEng;
};

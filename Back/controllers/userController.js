const User = require("../models/userModel");
const catchAsync = require("../utils/cathAsync");
const AppError = require("../utils/appError");
// modulo usado para ahcer peticiones a la API de renaper
const axios = require("axios");
const { URL_RENAPER, KEY_RENAPER } = require("../config");

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
  // si esta todo oc actualizamos los datos
  req.user.isRisk = req.body.isRisk;
  req.user.updatedHealthData = true;

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
  // validamos los datos de la persona
  await validRenaper(usrData.dni, usrData.tramit, usrData.gender);

  // obtenemos los datos
  // objeto de configuracion axios
  const options = {
    url: "/person/lookup",
    method: "post",
    baseURL: URL_RENAPER,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "X-Api-Key": KEY_RENAPER,
      "Content-Type": "application/json",
    },
    data: { dni: usrData.dni },
    // data: { dni: "43521062" },
    timeout: 5000,
  };
  // obtenemos los datos de la persona del renaper
  // chequeamos que el error sea un error reintenable (403)
  let resRenaper;
  try {
    resRenaper = await axios(options);
  } catch (err) {
    if (
      err.response.status == 403 ||
      err.response.status == 429 ||
      err.response.status == 502
    )
      throw new AppError("Error reintentable del renaper", 403);
    throw new AppError(
      `No se pudo encontrar datos correspondientes a ese dni`,
      404
    );
  }
  const userEspañol = resRenaper.data.data
    ? resRenaper.data.data
    : resRenaper.data;

  // chequeamos si se encontro a la persona
  if (!userEspañol) throw new AppError("No se encontro a la persona", 404);

  // si la persona es una persona juridica devolvemos un error
  if (userEspañol.tipoPersona === "JURIDICA")
    throw new AppError("Solo se aceptan personas fisicas", 401);

  // pasamos la data del usuario al formato de la base de datos
  const newUserData = dataFormat(userEspañol, usrData);

  return newUserData;
};
/**
 * Esta funcion retorna si un dni es valido para la API de renaper
 * @param {String} dni dni de la persona a validar
 * @param {String} tramit nro de tramite de la persona a validar (en este caso recibe el CUIT)
 * @param {String} gender genro de la persona a validar
 */
const validRenaper = async (dni, tramit, gender) => {
  const options = {
    url: "/person/validate",
    method: "post",
    baseURL: URL_RENAPER,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "X-Api-Key": KEY_RENAPER,
      "Content-Type": "application/json",
    },
    data: { dni: dni, tramite: tramit, sexo: gender },
    timeout: 5000,
  };

  // probamos validar los datos del usuario
  try {
    const x = await axios(options);
    console.log(x);
    console.log("RES VALID");
  } catch (err) {
    if (
      err.response.status == 403 ||
      err.response.status == 429 ||
      err.response.status == 502
    )
      throw new AppError("Error reintentable del renaper", 403);
    throw new AppError(`No se pudieron validar los datos`, 404);
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
  usrEng.fullName = ` ${usrEsp.apellido} ${usrEsp.nombre ? usrEsp.nombre : ""}`;
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

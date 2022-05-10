const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const catchAsync = require("../utils/cathAsync");
const { promisify } = require("util");
const sendMail = require("../utils/email");
const userController = require("../controllers/userController");

// estas deberian ser varaibles de entorno pero por ahora las declaro aca
const JWT_EXPIRES_IN = "10m";
const JWT_SECRET = "my-ultra-secreto-y-ultra-largo-jwt";
const JWT_COOKIE_EXPIRES_IN = 90;
////////////////

/**
 * Esta funcion crea un token jwt
 * @param {String} id es la id del usuario que quiere Registrarse/Iniciar sesion
 * @returns el jwt correspondiente a esa id
 */
const signupToken = (id) => {
  const miJwt = jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return miJwt;
};
/**
 * Esta funcion crea un jwt y lo alamcena en una cookie
 * @param {Object} usr es el usuario que esta intentado logearse o registrarse
 * @param {Response} res es el objeto response
 */
const createSendToken = (usr, res) => {
  const token = signupToken(usr._id);
  const cookieOptions = {
    expires: new Date(Date.now() + 10 * 60 * 1000),
    secure: false, // este campo en PRODUCCION deberia ser verdadero
    httpOnly: true,
  };

  res.cookie("jwt", token, cookieOptions);

  // no tengo las mas minima idea de como llegue a esta solucion... pero me sobran pelotas
  const noCorsCookie = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", `${noCorsCookie}; SameSite=None; Secure`);

  res.status(201).json({
    status: "success",
    data: { usr },
  });
};
/**
 * Esta funcion crea un jwt con un codigo y lo alamecena. Tambien manda un mail al usuario con el codigo
 * @param {Number} val es el codigo que se envia por mail
 * @param {Response} res es el objeto response
 */
const createSendTokenMail = (val, res, mail) => {
  const token = signupToken(val);
  const cookieOptions = {
    expires: new Date(Date.now() + 10 * 60 * 1000),
    secure: false, // este campo en PRODUCCION deberia ser verdadero
    httpOnly: true,
  };

  // guardo el codigo que se envio en una cookie
  res.cookie("jwtMail", token, cookieOptions);

  // enviamos el token por mail
  sendMail({
    message: `Tu codigo es: ${val}`,
    email: mail,
  });

  res.status(201).json({
    status: "success",
    data: {},
  });
};
/**
 * Esta funcion registra una cookie con los datos del usuario qu quiere registrarse y llama a la funcion createSendTokenMail
 * @param {Request} req es el objeto request
 * @param {Response} res es el objeto response
 * @param {function} next es la funcion que utilizamos para seguir con el flujo de middlewares
 */
exports.signup = catchAsync(async (req, res, next) => {
  //verificamos que no se quiera crear un vacunador o admin
  if (["admin", "vacc"].includes(req.body.rol))
    return next(new Error("Solo el administrador puede hacer eso"));

  // consultamos la api del renaper para completar los datos
  // req.body.email = req.body.email.toLowerCase();
  const dataNewUser = await userController.userRenaper(req.body);

  // guardamos los datos del usuario que quiere registrarse en una cookie
  res.cookie("userAuthData", dataNewUser);

  // creamos el JWT y lo almacenamos en la cookie
  createSendTokenMail("1234", res, req.body.email);
});
/**
 * Esta funcion inicia la sesion de un usuario existente
 * @param {Request} req es el objeto request
 * @param {Response} res es el objeto response
 * @param {function} next es la funcion que utilizamos para seguir con el flujo de middlewares
 */
exports.login = catchAsync(async (req, res, next) => {
  console.log("Datos del usuario que quiere iniciar sesion: ", req.body);
  console.log("cookies: ", req.cookies);
  console.log(
    "HEADER LOGIN-----------",
    res.getHeader("Access-Control-Allow-Credentials")
  );

  console.log("COOKIES DE LA REQ ", req.cookies.jwt);

  const { dni, password, code } = { ...req.body };

  // chequeamos si ingresoe l dni y la contraseña
  if (!dni || !password)
    return next(new Error("Por favor ingrese el dni y la contraseña"));

  // chequeamos i existe un usuario para esos datos
  const user = await User.findOne({ dni, password, code });
  console.log(user);
  if (!user)
    return next(new Error("Alguno de los datos ingresados es incorrecto"));

  // si todo esta ok enviamos el token
  createSendToken(user, res);
});
/**
 * Esta funcion borra todas las cookies
 * @param {Request} req es el objeto request
 * @param {Response} res es el objeto response
 * @param {function} next es la funcion que utilizamos para seguir con el flujo de middlewares
 */
exports.logout = catchAsync(async (req, res, next) => {
  res.clearCookie("jwt");
  res.clearCookie("jwtMail");
  res.clearCookie("userAuthData");

  res.status(200).json({
    status: "success",
  });
});
/**
 * Esta funcion comprueba que el usuario tenga la sesion iniciada, comprobando la veraciodad del jwt. Ademas pasa los datos del usuario a la proxima middleware
 * @param {Request} req es el objeto request
 * @param {Response} res es el objeto response
 * @param {function} next es la funcion que utilizamos para seguir con el flujo de middlewares
 */
exports.protect = catchAsync(async (req, res, next) => {
  let token;

  // conseguimos el token y chequeamos si existe
  if (req.cookies && req.cookies.jwt) token = req.cookies.jwt;
  if (!token) return next(new Error("No se encontro el Json Web Token.."));

  // verificamos si el token es correcto
  // para eso convertimos el metodo en una promesa, ya que estamos en una funcion async
  const decodedToken = await promisify(jwt.verify)(token, JWT_SECRET);

  // chequeamos si el token decodificado corresponde a un usuario existente
  const user = await User.findById(decodedToken.id);
  if (!user) return next(new Error("El usuario no existe mas.."));

  // podemos realizar mas checks que nos interesen
  req.user = user;
  next();
});
/**
 * Esta funcion confirma que el codigo ingresado en la url corresponde al almacenado en la cookie, si es correcto crea al usuario en cuestion
 * @param {Request} req es el objeto request
 * @param {Response} res es el objeto response
 * @param {function} next es la funcion que utilizamos para seguir con el flujo de middlewares
 */
exports.confirmAcount = catchAsync(async (req, res, next) => {
  let token;

  // conseguimos el token y chequeamos si existe
  if (req.cookies && req.cookies.jwtMail) token = req.cookies.jwtMail;
  if (!token) return next(new Error("No se encontro el Json Web Token.."));

  // verificamos si el token es correcto
  // para eso convertimos el metodo en una promesa, ya que estamos en una funcion async
  const decodedToken = await promisify(jwt.verify)(token, JWT_SECRET);

  if (!(decodedToken.id == req.params.token))
    return next(new Error("El codido de verificacion es incorrecto"));

  // almacenamos el codigo en el usuario y lo creamos
  req.cookies.userAuthData.code = req.params.token + "";
  const newUser = await User.create(req.cookies.userAuthData);

  createSendToken(newUser, res);
});
/**
 * Esta funcion restringe el acceso a las funcionalidades siguientes a los roles pasados por parametros
 * @param  {...String} roles roles con acceso
 * @returns una funcion middleware
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    console.log(roles, req.user.rol);
    if (!roles.includes(req.user.rol))
      return next(new Error(`El rol:  ${req.user.rol}  no esta en la lista`));
    next();
  };
};

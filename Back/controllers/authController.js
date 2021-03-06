const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const catchAsync = require("../utils/cathAsync");
const { promisify } = require("util");
const sendMail = require("../utils/email");
const userController = require("../controllers/userController");
const AppError = require("../utils/appError");

// estas deberian ser varaibles de entorno pero por ahora las declaro aca
const {
  JWT_EXPIRES_IN,
  JWT_SECRET,
  JWT_COOKIE_EXPIRES_IN,
  COOKIE_EXPIRES,
  TOKEN_EXPIRES,
} = require("../config");
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
const createSendToken = (usr, res, mismoSitio = false) => {
  const token = signupToken(usr._id);
  const cookieOptions = {
    expires: new Date(Date.now() + COOKIE_EXPIRES),
    secure: false, // este campo en PRODUCCION deberia ser verdadero
    httpOnly: true,
  };

  res.cookie("jwt", token, cookieOptions);

  // no tengo las mas minima idea de como llegue a esta solucion... pero me sobran pelotas

  if (!mismoSitio) {
    const noCorsCookie = res.getHeader("Set-Cookie");
    res.setHeader("Set-Cookie", `${noCorsCookie}; SameSite=None; Secure`);
  }

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
    expires: new Date(Date.now() + TOKEN_EXPIRES),
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
  // comprobamso que se ingresen todos los datos
  if (
    !req.body.dni ||
    !req.body.email ||
    !req.body.password ||
    !req.body.tramit ||
    !req.body.gender
  )
    return next(new AppError("Por favor ingresa todos los datos", 400));

  // verificamos que no exista alguien conese dni
  const user = await User.find({ dni: req.body.dni });
  if (user.length)
    return next(new AppError("El DNI ingresado ya est?? registrado.", 400));

  // consultamos la api del renaper para completar los datos
  // req.body.email = req.body.email.toLowerCase();
  req.body.rol = "user";
  const dataNewUser = await userController.userRenaper(req.body);

  // guardamos los datos del usuario que quiere registrarse en una cookie
  const cookieOptions = {
    expires: new Date(Date.now() + COOKIE_EXPIRES),
    secure: false, // este campo en PRODUCCION deberia ser verdadero
    httpOnly: true,
  };
  res.cookie("userAuthData", dataNewUser, cookieOptions);

  // creamos el JWT y lo almacenamos en la cookie
  //Insertar randomCode() en vez de 1234
  createSendTokenMail(1234, res, req.body.email);
});
/**
 * Esta funcion inicia la sesion de un usuario existente
 * @param {Request} req es el objeto request
 * @param {Response} res es el objeto response
 * @param {function} next es la funcion que utilizamos para seguir con el flujo de middlewares
 */
exports.login = catchAsync(async (req, res, next) => {
  const { dni, password, code } = { ...req.body };

  // chequeamos si ingresoe l dni y la contrase??a
  if (!dni || !password || !code)
    return next(new AppError("Por favor ingresa todos los datos", 400));

  // chequeamos i existe un usuario para esos datos
  const user = await User.findOne({ dni, password, code });
  if (!user)
    return next(
      new AppError("Alguno de los datos ingresados es incorrecto.", 404)
    );

  // esto va solo en modo dev
  const mismoSitio = req.headers.host === "127.0.0.1:8082";
  // si todo esta ok enviamos el token
  createSendToken(user, res, mismoSitio);
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
  if (!token) return next(new AppError("No estas logeado/registrado.", 401));

  // verificamos si el token es correcto
  // para eso convertimos el metodo en una promesa, ya que estamos en una funcion async
  const decodedToken = await promisify(jwt.verify)(token, JWT_SECRET);

  // chequeamos si el token decodificado corresponde a un usuario existente
  const user = await User.findById(decodedToken.id);
  if (!user) return next(new AppError("El usuario no existe mas.", 404));

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
  if (!token)
    return next(
      new AppError(
        "El c??digo que ingresaste se ha vencido. Vuelva a la pantalla de registro para recibir uno nuevo.",
        401
      )
    );

  // verificamos si el token es correcto
  // para eso convertimos el metodo en una promesa, ya que estamos en una funcion async
  const decodedToken = await promisify(jwt.verify)(token, JWT_SECRET);

  if (!(decodedToken.id == req.body.token))
    return next(new AppError("El c??digo que ingresaste es incorrecto.", 401));

  // almacenamos el codigo en el usuario y lo creamos
  req.cookies.userAuthData.code = req.body.token + "";
  const newUser = await User.create(req.cookies.userAuthData);

  // limpiamos las cookies que no usamos mas y logeamos al cliente
  res.clearCookie("jwt");
  res.clearCookie("jwtMail");
  res.clearCookie("userAuthData");

  // esto va solo en modo dev
  const mismoSitio = req.headers.host === "127.0.0.1:8082";
  // si todo esta ok enviamos el token
  createSendToken(newUser, res, mismoSitio);
});
/**
 * Esta funcion restringe el acceso a las funcionalidades siguientes a los roles pasados por parametros
 * @param  {...String} roles roles con acceso
 * @returns una funcion middleware
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol))
      return next(
        new AppError(`El rol:  ${req.user.rol}  no esta en la lista`, 401)
      );
    next();
  };
};

const randomPassword = () => {
  // hay que mejorar esto
  return "12345678";
};

exports.randomPassword;

const randomCode = () => {
  // hay que mejorar esto
  let code = (Math.random() * 10000).toFixed(0);
  code = code < 1000 ? 1001 : code;
  code = code == 10000 ? 9999 : code; // seria gracioso que justo justo sea 10000, osea es una probabilidad re chica alta mala leche tenia si justo pasaba esto en la demo jajaja igual ni idea pq escribo este comentario tan largo si nadie lo va a leer en fin aguante la fafafa
  // return code;
  return 1234; // por ahora retorno esto para probar
};

exports.randomCode;

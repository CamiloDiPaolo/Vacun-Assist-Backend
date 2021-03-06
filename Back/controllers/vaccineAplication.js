const catchAsync = require("./../utils/cathAsync");
const AppError = require("./../utils/appError");
const Appointment = require("./../models/appointmentModel");
const User = require("./../models/userModel");
const Stock = require("./../models/stockModel");
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
  console.log(await isCancelable(req.user.dni, req.body.vaccine));
  if (await isCancelable(req.user.dni, req.body.vaccine)) {
    appointmentUtils.cancelActiveAppointments(req.user.dni, req.body.vaccine);
  }
  // si el usuario ya tiene un turno activo contra la vacuna se debe ver si modificarlo o no
  if (
    await isModificable(
      req.user.dni,
      req.body.vaccine,
      new Date(req.body.vaccinationDate)
    )
  ) {
    appointmentUtils.modifyActiveAppointments(
      req.user.dni,
      req.body.vaccine,
      new Date(req.body.vaccinationDate)
    );
  }

  const newAppointment = await Appointment.create(req.body);

  newAppointment.vaccinationDate.setHours(25);
  await Appointment.findByIdAndUpdate(newAppointment._id, {
    vaccinationDate: newAppointment.vaccinationDate,
  });

  res.status(201).json({
    status: "success",
    data: newAppointment,
  });
});

const isModificable = async (dni, vaccine, vaccineDate) => {
  const activeAppointment = await appointmentUtils.getActiveAppointment(
    dni,
    vaccine
  );
  if (!activeAppointment) return false;
  const diffTime =
    activeAppointment.vaccinationDate.getTime() - vaccineDate.getTime();

  // si la diferencia es menor a 3 meses se cancela los turnos de covid
  if (vaccine == "Covid" && diffTime / (1000 * 60 * 60 * 24) < 90) return true;

  // si la diferencia es menor a 1 a??o se cancela los turnos de gripe
  if (vaccine == "Gripe" && diffTime / (1000 * 60 * 60 * 24) < 365) return true;
  // si no pasa nada raro no se cancelan los turnos
  return false;
};

const isCancelable = async (dni, vaccine) => {
  // si no tiene turnos activos no se puede cancelar equisde
  if ((await appointmentUtils.hasActiveAppointment(dni, vaccine)) == 0)
    return false;

  if (vaccine == "FiebreAmarilla")
    // si la vacuna es fiebre amarilla cancelamos cualquier turno que tenga
    return true;

  // si con la nueva vacuna se completan las 4 dosis de covid
  console.log(await appointmentUtils.hasAppointment(dni, vaccine));
  if (
    vaccine == "Covid" &&
    (await appointmentUtils.hasAppointment(dni, vaccine)) >= MAX_COVID_DOSIS
  )
    return true;

  return false;
};

exports.searchAppointments = catchAsync(async (req, res, next) => {
  console.log("MOMENTO BUSCAR");
  const patient = await User.findOne({ dni: req.params.dni });

  // si el dni esta registrado devolvemos sus turnos
  if (patient) {
    let allAppointment = await Appointment.find({ patientDni: patient.dni });
    allAppointment = allAppointment.filter((appointment) => {
      return (
        appointment.state == "Activo" &&
        appointment.vaccinationDate.getTime() ==
          appointmentUtils.getCurrentDate().getTime()
      );
    });

    return res.status(200).json({
      status: "success",
      data: { patient: patient, appointments: allAppointment },
    });
  }

  console.log("Buscar en el Renaper");
  // si el dni no esta registrado  validamos con el renaper
  const user = await userController.userRenaperNoValid({ dni: req.params.dni });

  res.status(200).json({
    status: "success",
    data: { patient: user },
  });
});

exports.validateLocalAplication = catchAsync(async (req, res, next) => {
  console.log("llegue a validar");
  // si el usuario ya esta vacunado contra esa vacuna no se permite sacar el turno
  const err = await appointmentValidation(
    req.body.dni,
    req.body.vaccine,
    req.body.birthday
  );
  console.log("Error");
  console.log(err);
  if (err) return next(new AppError(err, 500));
  const stock = await Stock.findOne({
    vaccinationCenter: req.user.vaccinationCenter,
    vaccine: req.body.vaccine,
  });
  if (stock.cant == 0)
    return next(new AppError("No hay disponibilidad para esta vacuna ????", 403));

  return res.status(201).json({
    status: "success",
    continue: true,
  });
});

exports.vaccineLocalAplication = catchAsync(async (req, res, next) => {
  console.log("LOCALIZAME LA APLICACION");
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
  console.log("Error");
  console.log(err);
  if (err) return next(new AppError(err, 500));
  if (!(await availability(req.body.vaccine, req.user.vaccinationCenter)))
    return next(new AppError("No hay disponibilidad para esta vacuna ????", 403));

  const newAppointments = await appointmentController.createAppointmentLocal({
    vaccine: req.body.vaccine,
    vaccinationCenter: req.user.vaccinationCenter,
    lot: req.body.lot,
    mark: req.body.mark,
    patientDni: req.body.dni,
    vaccunator: req.user.fullName,
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

  // si todo sale OC registro al usuario en el sistema y le envio su codigo y contrase??a por mail

  const userData = await userController.userRenaperNoValid({
    dni: req.body.dni,
  });
  (userData.rol = "user"), (userData.password = randomPassword());
  userData.code = randomCode();
  userData.email = req.body.email;

  const newUser = await User.create(userData);

  sendMail({
    message: `Tu contrase??a es: ${userData.password} y tu codigo es: ${userData.code}`,
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

const availability = async (vaccine, vaccinationCenter) => {
  try {
    const stock = await Stock.findOne({
      vaccinationCenter: vaccinationCenter,
      vaccine: vaccine,
    });

    await Stock.findByIdAndUpdate(stock._id, {
      cant: stock.cant == 0 ? 0 : stock.cant - 1,
    });

    return stock.cant > 0;
  } catch (err) {
    return false;
  }
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
    return `El usuario ya tiene ${MAX_COVID_DOSIS} dosis aplicadas ????`;
  if (await appointmentUtils.hasActiveAppointment(dni, vaccine))
    return "Ya tenes un turno contra esta vacuna o tenes un turno en espera ????";
  if (
    vaccine == "FiebreAmarilla" &&
    (await appointmentUtils.hasAppointment(dni, vaccine)) > 0
  )
    return `El usuario ya tiene la dosis aplicada ????`;
  // comprobamos los temas de la edad
  if (age < 18 && vaccine == "Covid")
    return "Por tu edad no podes vacunarte con esta vacuna????";
  if (age > 60 && vaccine == "FiebreAmarilla")
    return "Por tu edad no podes vacunarte con esta vacuna????";
  if (
    vaccine == "Covid" &&
    (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) < 3 &&
    (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) != null &&
    !(await appointmentUtils.hasActiveAppointment(dni, vaccine))
  )
    return "El usuario tiene que esperar m??nimo 3 meses desde su ultima aplicaci??n para vacunarse nuevamente ????";
  console.log("Diferencia de Meses");
  console.log(await appointmentUtils.lastAppointmentMonth(dni, vaccine));
  if (
    vaccine == "Covid" &&
    (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) < 3 &&
    (await appointmentUtils.hasActiveAppointment(dni, vaccine))
  )
    return "Ya tenes un turno contra esta vacuna o tenes un turno en espera ????";
  if (
    vaccine == "Gripe" &&
    (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) < 12 &&
    (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) != null
  )
    return "El usuario tiene que esperar m??nimo 1 a??o desde su ultima aplicaci??n para vacunarse nuevamente ????";
  return "";
};

/**
 * Esta funcion devuelve la fecha para el turno que intenta sacar el usuario
 * @param {Date} birthday es la fehca de nacimiento correspondiente al dni
 * @param {String} vaccine es la vacuna del turno
 * @param {Boolean} isRisk si el usuario es de riesgo o no
 * @param {String} dni es el dni correspondiente al paciente de los turnos
 * @returns la fecha del turno o null si el turno es pendiente
 */
const getAppointmentDate = async (birthday, vaccine, isRisk, dni) => {
  const birthdayDate = new Date(birthday);
  const currentDate = appointmentUtils.getCurrentDate();

  let age = currentDate.getFullYear() - birthdayDate.getFullYear();
  age = birthdayDate.getMonth() < currentDate.getMonth() ? age : age - 1;

  // condiciones para la Gripe
  if (vaccine === "Gripe") {
    if ((await appointmentUtils.lastAppointmentMonth(dni, vaccine)) >= 12) {
      currentDate.setUTCDate(currentDate.getDate() + 7);
      return currentDate;
    } else if (
      (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) < 12 &&
      (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) != null
    ) {
      const nextDate = appointmentUtils.getCurrentDate();
      nextDate.setUTCMonth(
        (
          await appointmentUtils.lastAppointment(dni, vaccine)
        ).vaccinationDate.getMonth()
      );
      nextDate.setUTCDate(
        (
          await appointmentUtils.lastAppointment(dni, vaccine)
        ).vaccinationDate.getDate()
      );
      nextDate.setFullYear(
        (
          await appointmentUtils.lastAppointment(dni, vaccine)
        ).vaccinationDate.getFullYear() + 1
      );

      const diffTime = nextDate.getTime() - currentDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      // si la diferencia de dias es menor o igual a 7 dias se saca el turno a una semana
      if (diffDays <= 7) {
        currentDate.setUTCDate(currentDate.getDate() + 7);
        return currentDate;
      }
      // si la diferencia de dias es mayor a 7 se saca a 12 meses de la fecha del ultimo turno
      return nextDate;
    }
    if (age < 60) {
      currentDate.setUTCMonth(currentDate.getMonth() + 6);
      return currentDate;
    }
    // si es mayor de 60 a??os
    currentDate.setUTCMonth(currentDate.getMonth() + 3);
    return currentDate;
  }

  // condiciones para el Covid
  if (vaccine == "Covid") {
    if (age > 18) {
      if (
        isRisk &&
        (await appointmentUtils.hasAppointment(dni, vaccine)) == 0
      ) {
        currentDate.setUTCDate(currentDate.getDate() + 7);
        return currentDate;
      } else if (
        (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) >= 3
      ) {
        // si el usuario no es de riesgo y tiene una vacuna de covid hace mas de 3 meses se saca a 7 dias
        currentDate.setUTCDate(currentDate.getDate() + 7);
        return currentDate;
      } else if (
        (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) < 3 &&
        (await appointmentUtils.lastAppointmentMonth(dni, vaccine)) != null
      ) {
        const nextDate = appointmentUtils.getCurrentDate();
        nextDate.setUTCDate(
          (
            await appointmentUtils.lastAppointment(dni, vaccine)
          ).vaccinationDate.getDate()
        );
        nextDate.setMonth(
          (
            await appointmentUtils.lastAppointment(dni, vaccine)
          ).vaccinationDate.getMonth() + 3
        );

        // si el usuario no es de riesgo y tiene una vacuna de covid hace menos de 3 meses se saca a 3 meses de la fecha del ultimo turno
        const diffTime = nextDate.getTime() - currentDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        // si la diferencia de dias es menor o igual a 7 dias se saca el turno a una semana
        if (diffDays <= 7) {
          currentDate.setUTCDate(currentDate.getDate() + 7);
          return currentDate;
        }
        // si la diferencia de dias es mayor a 7 se saca a 3 meses d ela fecha del ultimo turno
        return nextDate;
      }
    }
    if (age > 60) {
      currentDate.setUTCDate(currentDate.getDate() + 7);
      return currentDate;
    }
    return null;
  }
  // condiciones para la Fiebre Amarilla
  if (vaccine == "FiebreAmarilla") return null;
  // si no se asgian nada algo se rompio feo
  throw new AppError("Algo salio mal a asignar el turno....", 500);
};

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

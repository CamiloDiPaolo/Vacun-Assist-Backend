const Appointment = require("../models/appointmentModel");
const catchAsync = require("../utils/cathAsync");
const AppError = require("../utils/appError");
const appointmentUtils = require("../appointmentUtils");

const MAX_COVID_DOSIS = 4;

/**
 * Esta funcion registra un turno virtual si el usuario cumple todas las condiciones
 * @returns el turno registrado o un error
 */
exports.createAppointmentVirtual = catchAsync(async (req, res, next) => {
  if (!req.body.vaccine)
    return next(
      new AppError("Tenes que ingresar una vacuna para solicitar un turno"),
      400
    );
  if (!req.body.vaccinationCenter)
    return next(
      new AppError(
        "Tenes que ingresar una centro de vacunacion para solicitar un turno"
      ),
      400
    );
  if (!req.user.updatedHealthData)
    return next(
      new AppError(
        "Tenes que completar tus datos de salud para poder sacar un turno"
      ),
      403
    );

  // si el usuario ya esta vacunado contra esa vacuna no se permite sacar el turno
  const err = await appointmentUtils.appointmentValidation(
    req.user.dni,
    req.body.vaccine,
    req.user.birthday
  );
  if (err) return next(new AppError(err, 500));

  // obtenes la fecha de vacunacion si cumple las condiciones
  let vaccinationDate = await getAppointmentDate(
    req.user.birthday,
    req.body.vaccine,
    req.user.isRisk,
    req.user.dni
  );

  // si no se le asigna fecha entonces el turno esta pendiente a la espera
  req.body.state = !vaccinationDate ? "Pendiente" : "Activo";
  if (vaccinationDate) req.body.vaccinationDate = vaccinationDate;

  // si esta todo correcto se sigue
  req.body.patientDni = req.user.dni;
  const newAppointment = await Appointment.create(req.body);

  res.status(201).json({
    status: "success",
    data: { newAppointment },
  });
});
/**
 * Esta funcion retorna todos los turnos dependiendo el rol del usuario
 * @returns el resultado de la consulta
 */
exports.getAppointments = catchAsync(async (req, res, next) => {
  const queryOptions = {};

  if (req.user.rol == "user") queryOptions.patientDni = req.user.dni;
  if (req.user.rol == "vacc") {
    queryOptions.vaccinationCenter = req.user.vaccinationCenter;
    queryOptions.vaccinationDate = appointmentUtils.getCurrentDate();
  }

  const appointments = await Appointment.find(queryOptions);

  res.status(200).json({
    status: "success",
    data: { appointments },
  });
});
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
    // si es mayor de 60 años
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

/**
 * Esta funcion permite a un vacunador validar un turno activo y generar o no un turno automatico
 * @returns el turno validado
 */
exports.validateAppointment = catchAsync(async (req, res, next) => {
  let appointment = await Appointment.findById(req.body.id);

  if (!appointment)
    throw new AppError(
      "No se encontro un turno que coincida con los datos ",
      400
    );
  if (["Finalizado", "Cancelado"].includes(appointment.state))
    throw new AppError("El turno no puede cambiar de estado", 400);
  if (!["Finalizado", "Cancelado"].includes(req.body.state))
    throw new AppError("El estado debe ser solo Finalizado o Cancelado", 400);
  if (!req.body.lot || !req.body.mark)
    throw new AppError("No ingresaste todos los datos..", 400);

  appointment.state = req.body.state;
  appointment.lot = req.body.lot;
  appointment.mark = req.body.mark;

  await Appointment.findByIdAndUpdate(appointment.id, appointment);

  // una vez que se valida correctamente el turno se crea uno nuevo dependiendo el tipo de vacuna
  const vaccine = appointment.vaccine;
  const dni = appointment.patientDni;

  if (
    !(vaccine == "FiebreAmarilla") &&
    !(
      vaccine == "Covid" &&
      (await appointmentUtils.hasAppointment(dni, vaccine)) >= MAX_COVID_DOSIS
    )
  ) {
    const newDate = appointmentUtils.getCurrentDate();

    // si la vacuna es gripe el turno se da a un año, si es covid a 3 meses
    if (vaccine == "Covid") newDate.setUTCMonth(newDate.getMonth() + 3);
    else newDate.setUTCFullYear(newDate.getFullYear() + 1);

    // eliminamos los campos para que crea mongoose para no tener problemas al crear uno nuevo
    const newAppointment = {
      state: "Activo",
      patientDni: appointment.patientDni,
      vaccine: appointment.vaccine,
      vaccinationDate: newDate,
      issueDate: new Date(),
      vaccinationCenter: appointment.vaccinationCenter,
    };
    appointment = await Appointment.create(newAppointment);
  }

  res.status(200).json({
    status: "success",
    data: {
      appointment,
    },
  });
});

/**
 * Esta funcion permite cancelar un turno(ESTA SIN IMPLEMENTAR TODAVIA)
 * @returns el turno cancelado
 */
exports.cancelAppointment = catchAsync(async (req, res, next) => {
  if (!req.body.id)
    return next(
      new AppError("Debe ingresar una id para eliminar el turno..", 400)
    );
  if (req.body.id.length != 24)
    return next(
      new AppError("El formato de id que ingresaste es incorrecto..", 400)
    );

  const appointment = await Appointment.findOne({
    patientDni: req.user.dni,
    _id: req.body.id,
  });

  if (!appointment) return next(new AppError("no se encontro un turno..", 400));

  if (appointment.state != "Activo")
    return next(
      new AppError("no podes cancelar un turno que no este activo..", 400)
    );
  appointment.state = "Cancelado";
  appointment.vaccinationDate = "Cancelado";

  await Appointment.findByIdAndUpdate(appointment.id, appointment);

  res.status(200).json({
    status: "success",
    data: {
      appointment,
    },
  });
});

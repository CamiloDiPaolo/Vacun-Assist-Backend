const Appointment = require("../models/appointmentModel");
const MAX_COVID_DOSIS = 4;

/**
 * Esta funcion retorna la cantidad de turnos activos y finalizados que tiene un usuario
 * @param {String} dni es el dni correspondiente al paciente de los turnos
 * @param {String} vac es la vacuna del turno
 * @returns la cantidad de turnos correspondiente al dni y vacuna pasados como parametro
 */
const hasAppointment = async (dni, vac) => {
  const allAppointment = await Appointment.find({
    $or: [{ state: "Finalizado" }, { state: "Activo" }],
    vaccine: vac,
    patientDni: dni,
  });

  return allAppointment.length;
};
module.exports = hasAppointment;

/**
 * Esta funcion retorna la cantidad de turnos activos y pendientes que tiene un usuario
 * @param {String} dni es el dni correspondiente al paciente de los turnos
 * @param {String} vac es la vacuna del turno
 * @returns la cantidad de turnos correspondiente al dni y vacuna pasados como parametro
 */
const hasActiveAppointment = async (dni, vac) => {
  const allAppointment = await Appointment.find({
    $or: [{ state: "Pendiente" }, { state: "Activo" }],
    vaccine: vac,
    patientDni: dni,
  });

  return allAppointment.length;
};
module.exports = hasActiveAppointment;
/**
 * Esta funcion retorna algun turno activo o pendiente que un dni tnega contra una vacuna
 * @param {String} dni es el dni correspondiente al paciente de los turnos
 * @param {String} vac es la vacuna del turno
 * @returns el primer turno activo/pendiente que se encuentre sobre esa vacuna
 */
exports.getActiveAppointment = async (dni, vac) => {
  const appointment = await Appointment.findOne({
    $or: [{ state: "Pendiente" }, { state: "Activo" }],
    vaccine: vac,
    patientDni: dni,
  });

  return appointment;
};

/**
 * esta funcion retorna la diferencia de meses del ultimo turno de una vacuna comparado con la fecha actual
 * @param {String} dni es el dni correspondiente al paciente de los turnos
 * @param {String} vac es la vacuna del turno
 * @returns la diferencia de meses con el ultimo turno de la vacuna dada con la fehca actual
 */
exports.lastAppointmentMonth = async (dni, vac) => {
  const allAppointment = await Appointment.find({
    state: "Finalizado",
    vaccine: vac,
    patientDni: dni,
  });

  if (allAppointment.length === 0) return null;

  // Math.min.apply(Math, nums);
  const lastDateTime = Math.max.apply(
    Math,
    allAppointment.map((appointment) =>
      new Date(appointment.vaccinationDate).getTime()
    )
  );
  const lastAppointment = allAppointment.find(
    (appointment) =>
      new Date(appointment.vaccinationDate).getTime() === lastDateTime
  );

  // comprobamos la cantidad de meses pedazo NOTAS
  const currentDate = new Date();
  const lastAppointmentDate = new Date(lastAppointment.vaccinationDate);

  let monthsDiff = (currentDate.getYear() - lastAppointmentDate.getYear()) * 12;
  monthsDiff += currentDate.getMonth();
  monthsDiff -= lastAppointmentDate.getMonth();
  return monthsDiff;
};

/**
 * Esta funcion retorna el ultimo turno de una vacuna dada de un usuario
 * @param {String} dni es el dni correspondiente al paciente de los turnos
 * @param {String} vac es la vacuna del turno
 * @returns el ultimo turno de  una vacuna dada para un usuario
 */
exports.lastAppointment = async (dni, vac) => {
  const allAppointment = await Appointment.find({
    state: "Finalizado",
    vaccine: vac,
    patientDni: dni,
  });

  if (allAppointment.length === 0) return 0;

  // Math.min.apply(Math, nums);
  const lastDateTime = Math.max.apply(
    Math,
    allAppointment.map((appointment) =>
      new Date(appointment.vaccinationDate).getTime()
    )
  );
  const last = allAppointment.find(
    (appointment) =>
      new Date(appointment.vaccinationDate).getTime() === lastDateTime
  );

  return last;
};

/**
 * Esta funcion comprueba que un usuario pueda sacar un turno para una vacuna en especifico
 * @param {String} dni es el dni correspondiente al paciente de los turnos
 * @param {String} vac es la vacuna del turno
 * @param {Date} birthday es la fehca de nacimiento correspondiente al dni
 * @returns un string vacio si no hay error o un string con el error correspondiente
 */
exports.appointmentValidation = async (dni, vaccine, birthday) => {
  const birthdayDate = new Date(birthday);
  const currentDate = new Date();
  let age = currentDate.getFullYear() - birthdayDate.getFullYear();
  age = birthdayDate.getMonth() < currentDate.getMonth() ? age : age - 1;

  // corroboramos la cantidad de turnos contra el covid que tiene
  if (
    vaccine == "Covid" &&
    (await hasAppointment(dni, vaccine)) >= MAX_COVID_DOSIS
  )
    return `No podes darte mas de ${MAX_COVID_DOSIS} vacunas contra el Covid 😅`;
  if (vaccine == "FiebreAmarilla" && (await hasAppointment(dni, vaccine)) > 0)
    return `No podes darte mas de 1 dosis contra la Fiebre Amarilla 😅`;

  // si ya tiene un turno o se vacuno contra la vacuna
  if (await hasActiveAppointment(dni, vaccine))
    return "Ya tenes un turno contra esta vacuna o tenes un turno en espera 😅";

  // comprobamos los temas de la edad
  if (age < 18 && vaccine == "Covid")
    return "Por tu edad no podes vacunarte con esta vacuna😅";
  if (age > 60 && vaccine == "FiebreAmarilla")
    return "Por tu edad no podes vacunarte con esta vacuna😅";
  return "";
};

/**
 * Esta funcion cancela todos los turnos activos/pendientes de un usuario para cierta vacuna
 * @param {String} dni es el dni correspondiente al paciente de los turnos
 * @param {String} vac es la vacuna del turno
 */
exports.cancelActiveAppointments = async (dni, vaccine) => {
  const allAppointment = await Appointment.find({
    $or: [{ state: "Pendiente" }, { state: "Activo" }],
    vaccine: vaccine,
    patientDni: dni,
  });

  allAppointment.forEach(async (appointment) => {
    await Appointment.findByIdAndUpdate(appointment._id, {
      state: "Cancelado",
    });
  });
};

/**
 * Esta funcion retorna la fecha actual pero con el tiempo formateado
 * @returns la fecha actual con el tiempo formateado
 */
exports.getCurrentDate = () => {
  const currentDate = new Date();

  currentDate.setHours(0);
  currentDate.setMinutes(0);
  currentDate.setSeconds(0);
  currentDate.setMilliseconds(0);

  return currentDate;
};

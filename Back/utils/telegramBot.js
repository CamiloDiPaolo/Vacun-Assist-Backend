const { Telegraf } = require("Telegraf");
const { KEY_TELEGRAM_BOT, PORT } = require("./../config");

const Appointment = require("./../models/appointmentModel");
const User = require("./../models/userModel");

const bot = new Telegraf(KEY_TELEGRAM_BOT);

let DNI = "";
let code = 0;
let usr = "";

bot.start((ctx) => {
  ctx.reply(`Bienvenido al bot de VacunAssist!
-Ingrese /login seguido de su DNI y codigo para ingresar. 
-Ingrese /help para consultar todos los comandos disponibles`);
});

bot.help((ctx) => {
  ctx.reply(`Todos los comandos disponibles son:
-/login [DNI] [codigo] Iniciar sesion
-/logout Cierra la sesion actual
-/turnos Muestra todos tus turnos
-/noticias Muestra noticias relacionadas a tus turnos
-/datos Muestra tus datos guardados`);
});

bot.command("login", (ctx) => {
  if (!DNI && !code) {
    DNI = ctx.update.message.text.split(" ", 3)[1];
    code = ctx.update.message.text.split(" ", 3)[2];
    let message = "";
    if (DNI && !isNaN(DNI)) {
      getUser(DNI).then((res) => {
        if (res && res.code === code) {
          usr = res;
          message = `Bienvenido ${usr.fullName}`;
        } else {
          message = `Los datos ingresados son incorrectos`;
        }
      });
      getAppointmentToSevenDays(DNI).then((res) => {
        if (res.length !== 0) {
          message = `${message}
Hay turnos activos dentro de 7 Dias o menos: `;
          res.forEach((appointment) => {
            const date = getFullDate(appointment.vaccinationDate);
            message = `${message}
        Estado: ${appointment.state}
        Vacuna: ${appointment.vaccine}
        Dia: ${date}
-------------------------------------------------------------------`;
          });
        }
        ctx.reply(message);
      });
    } else {
      ctx.reply("Debe ingresar un DNI Valido");
    }
  } else
    ctx.reply(`Ya tenes una sesion iniciada!
-Ingresa /logout para salir de la sesion actual!
-Ingrese /help para consultar todos los comandos disponibles`);
});

bot.command("logout", (ctx) => {
  if (DNI && code) {
    DNI = "";
    code = "";
    usr = "";
  } else
    ctx.reply(`No tenes ninguna sesion iniciada
-Ingrese /login seguido de su DNI y codigo para ingresar. 
-Ingrese /help para consultar todos los comandos disponibles`);
});

bot.command("turnos", (ctx) => {
  if (usr) {
    let message =
      "------------------------ Tus Turnos ------------------------";
    getAllApointments(usr.dni).then((res) => {
      res.forEach((appointment) => {
        const date = appointment.vaccinationDate
          ? getFullDate(appointment.vaccinationDate)
          : "A confirmar";
        message = `${message}
        Estado: ${appointment.state}
        Vacuna: ${appointment.vaccine}
        Dia: ${date}
-------------------------------------------------------------------`;
      });
      ctx.reply(message);
    });
  } else {
    ctx.reply(`Debe Iniciar Sesion para utilizar este comando
-Ingrese /login seguido de su DNI y codigo para ingresar. 
-Ingrese /help para consultar todos los comandos disponibles`);
  }
});

bot.command("noticias", (ctx) => {
  if (usr) {
    let message = "No hay turnos activos para dentro de 7 Dias o menos....";
    getAppointmentToSevenDays(DNI).then((res) => {
      if (res.length !== 0) {
        message = `Hay turnos activos dentro de 7 Dias o menos: `;
        res.forEach((appointment) => {
          const date = getFullDate(appointment.vaccinationDate);
          message = `${message}
      Estado: ${appointment.state}
      Vacuna: ${appointment.vaccine}
      Dia: ${date}
-------------------------------------------------------------------`;
        });
      }
      ctx.reply(message);
    });
  } else
    ctx.reply(`Debe Iniciar Sesion para utilizar este comando
-Ingrese /login seguido de su DNI y codigo para ingresar. 
-Ingrese /help para consultar todos los comandos disponibles`);
});

bot.command("datos", (ctx) => {
  if (usr) {
    let message = `Tus Datos almacenados son:
Nombre Completo: ${usr.fullName}
DNI: ${usr.dni}
CUIL: ${usr.cuil}
Mail: ${usr.email}
Persona de Riesgo: ${usr.isRisk ? "SI" : "NO"}
`;
  } else
    message = `Debe Iniciar Sesion para utilizar este comando
-Ingrese /login seguido de su DNI y codigo para ingresar. 
-Ingrese /help para consultar todos los comandos disponibles`;
  console.log(usr);
});

const getUser = async (dni) => {
  const usr = await User.findOne({ dni: dni });
  return usr;
};

const getAllApointments = async (dni) => {
  const appointments = await Appointment.find({ patientDni: dni });
  return appointments;
};

const getAppointmentToSevenDays = async (dni) => {
  const appointments = await Appointment.find({ patientDni: dni });

  const array = appointments.filter((appointment) => {
    if (appointment.state === "Activo") {
      return checkIfDays(appointment.vaccinationDate);
    } else return false;
  });

  return array;
};

const checkIfDays = (date) => {
  const newDate = new Date(date);
  const currentDate = new Date();

  newDate.setHours(1);
  newDate.setMinutes(0);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);

  currentDate.setHours(1);
  currentDate.setMinutes(0);
  currentDate.setSeconds(0);
  currentDate.setMilliseconds(0);

  //si la fecha que se pasa por parametro es mmayor a 7 dias devuelve true
  return newDate.getTime() - currentDate.getTime() <= 1000 * 60 * 60 * 24 * 7;
};

const getFullDate = (vaccinationDate) => {
  if (vaccinationDate) {
    const date = new Date(vaccinationDate);
    const months = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    return `${date.getDate()} de ${
      months[date.getMonth()]
    } de ${date.getFullYear()} `;
  } else return undefined;
};

bot.launch();

const { Telegraf } = require("Telegraf");
const { KEY_TELEGRAM_BOT, PORT } = require("./../config");
const Calendar = require("telegraf-calendar-telegram");

//Hacerlo con esto genera incostiencias cuando cambia la resolucion
// const { Calendar } = require("node-calendar-js");

// No se puede hacer con archivos ICS
// const ics = require("ics");

const Appointment = require("./../models/appointmentModel");
const User = require("./../models/userModel");

const bot = new Telegraf(KEY_TELEGRAM_BOT);

let usr;

const calendar = new Calendar(bot, {
  startWeekDay: 1,
  weekDayNames: ["Lun", "Mar", "Mier", "Jue", "Vie", "Sab", "Dom"],
  monthNames: [
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
  ],
});

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
-/suscribirse Permite el envio de Notificaciones via Telegram
-/desuscribirse Anula el envio de Notificaciones via Telegram`);
});

bot.command("login", async (ctx) => {
  const DNI = ctx.update.message.text.split(" ", 3)[1];
  const code = ctx.update.message.text.split(" ", 3)[2];
  let message = "";
  if (!usr) {
    if (DNI && !isNaN(DNI)) {
      usr = await getUser(DNI);
      if (usr && usr.code === code) {
        message = `Bienvenido ${usr.fullName}`;
        logged = true;
        usr = await updateTelegramID(usr, ctx.update.message.chat.id);
      } else {
        message = `Los datos ingresados son incorrectos`;
        usr = "";
      }
    } else message = "Debe Ingresar un DNI valido";
    ctx.reply(message);
  } else
    ctx.reply(`Ya tenes una sesion iniciada!
-Ingresa /logout para salir de la sesion actual!
-Ingrese /help para consultar todos los comandos disponibles`);
});

bot.command("logout", async (ctx) => {
  if (usr) {
    await User.findByIdAndUpdate(usr._id, {
      telegramID: "",
    });
    usr = "";
    ctx.reply("Cerraste sesión!");
  } else
    ctx.reply(`No tenes ninguna sesion iniciada
-Ingrese /login seguido de su DNI y codigo para ingresar. 
-Ingrese /help para consultar todos los comandos disponibles`);
});

bot.command("turnos", async (ctx) => {
  if (usr) {
    const appointment = await getAllApointments(usr.dni);
    if (appointment.length == 0) {
      ctx.reply("Aún no tenes turnos vinculados.");
    } else {
      const { max, min } = MaxMinDate(appointment);
      max.setDate(31);
      min.setDate(1);
      calendar.setMinDate(min).setMaxDate(max);

      calendar.setDateListener((context, date) => {
        const notPendingAppointments = appointment.filter(
          (app) => app.state !== "Pendiente"
        );
        notPendingAppointments.map((app) => {
          const stringDate = app.vaccinationDate.toISOString().split("T", 1)[0];
          if (stringDate === date) {
            let message = " Turno:  ";
            const date = getFullDate(app.vaccinationDate);
            message = `${message}
            Estado: ${
              app.vaccinationCenter === "Externo"
                ? "Ingresado por usuario 👍"
                : app.state === "Finalizado"
                ? "concretado ✅"
                : app.state === "Activo"
                ? "pendiente ⌛"
                : app.state === "Pendiente"
                ? "En espera ⛔"
                : "cancelado ❌"
            }
            Vacuna: ${app.vaccine}
            Vacunatorio: ${app.vaccinationCenter}
            Dia: ${date}`;
            ctx.reply(message);
          }
        });
      });

      let msg = await modifyMessage(appointment);
      const newCalendar = await modifyCalendar(calendar.getCalendar());
      msg = `Seleccione un simbolo para obtener mas informacion sobre el turno:
👍: Turno ingresado por el usuario
✅: Turno Finalizado
❌: Turno Cancelado
⌛: Turno Pendiente
(Si tiene mas de un turno el mismo dia, se motraran todos los turnos)
${msg}`;
      ctx.reply(msg, newCalendar);
    }
  } else {
    ctx.reply(`Debe Iniciar Sesion para utilizar este comando
-Ingrese /login seguido de su DNI y codigo para ingresar. 
-Ingrese /help para consultar todos los comandos disponibles`);
  }
});

bot.command("suscribirse", async (ctx) => {
  if (usr) {
    if (!usr.telegramSuscribe) {
      usr = await User.findByIdAndUpdate(usr._id, {
        telegramSuscribe: true,
      });
      ctx.reply(
        "Felicidades. Ahora recibiras notificaciones desde esta conversacion!! 🎊🎉🎉🎊"
      );
    } else {
      ctx.reply(`Ya estas suscrito 😅.
Si queres desuscribirte ingresa /desuscribirse`);
    }
  } else {
    ctx.reply(`Debe Iniciar Sesion para utilizar este comando
-Ingrese /login seguido de su DNI y codigo para ingresar. 
-Ingrese /help para consultar todos los comandos disponibles`);
  }
});

bot.command("desuscribirse", async (ctx) => {
  if (usr) {
    if (usr.telegramSuscribe) {
      usr = await User.findByIdAndUpdate(usr._id, {
        telegramSuscribe: false,
      });
      ctx.reply(
        "Ya no recibiras mas notificaciones desde esta conversacion... Perdon por molestar 😥"
      );
    } else {
      ctx.reply(`No estas suscrito a telegram... 
Si queres suscribirte ingresa /suscribirse`);
    }
  } else {
    ctx.reply(`Debe Iniciar Sesion para utilizar este comando
-Ingrese /login seguido de su DNI y codigo para ingresar. 
-Ingrese /help para consultar todos los comandos disponibles`);
  }
});

bot.action(/calendar-telegram-next-[\d-]+/g, async (context) => {
  let dateString = context.match[0].replace("calendar-telegram-next-", "");
  let date = new Date(dateString);
  date.setMonth(date.getMonth() + 1);

  let prevText = context.callbackQuery.message.text;

  let prevEntities = context.callbackQuery.message.entities;
  let extras = {
    ...calendar.helper.getCalendarMarkup(date),
    entities: prevEntities,
  };
  extras.reply_markup = (
    await modifyCalendar(calendar.helper.getCalendarMarkup(date))
  ).reply_markup;
  return context
    .answerCbQuery()
    .then(() => context.editMessageText(prevText, extras));
});

bot.action(/calendar-telegram-prev-[\d-]+/g, async (context) => {
  let dateString = context.match[0].replace("calendar-telegram-prev-", "");
  let date = new Date(dateString);
  date.setMonth(date.getMonth() - 1);

  let prevText = context.callbackQuery.message.text;

  let prevEntities = context.callbackQuery.message.entities;
  let extras = {
    ...calendar.helper.getCalendarMarkup(date),
    entities: prevEntities,
  };
  extras.reply_markup = (
    await modifyCalendar(calendar.helper.getCalendarMarkup(date))
  ).reply_markup;
  return context
    .answerCbQuery()
    .then(() => context.editMessageText(prevText, extras));
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

const updateTelegramID = async (usr, id) => {
  const user = await User.findByIdAndUpdate(usr._id, {
    telegramID: id,
  });
  return user;
};

const sendMessage = async (id, appointment) => {
  bot.telegram.sendMessage(
    id,
    `Tenes un turno para la vacuna contra ${appointment.vaccine} mañana en el vacunatorio ${appointment.vaccinationCenter}`
  );
};

const MaxMinDate = (appointments) => {
  const notPending = appointments.filter((app) => app.state !== "Pendiente");
  let = new Date();
  let = new Date();
  if (notPending.length === 0) {
    max = new Date();
    min = new Date();
  } else {
    max = new Date(notPending[0].vaccinationDate);
    min = new Date(notPending[0].vaccinationDate);
    notPending.map((app) => {
      const date = new Date(app.vaccinationDate);
      max = Date.parse(date) > Date.parse(max) ? date : max;
      min = Date.parse(date) < Date.parse(min) ? date : min;
    });
  }
  return { max: max, min: min };
};

const modifyMessage = async (appointments) => {
  const pendingAppointments = appointments.filter(
    (app) => app.state === "Pendiente"
  );
  if (pendingAppointments.length > 0) {
    let message = "Ademas, tenes Turnos en espera ⛔ para: ";
    pendingAppointments.map((app) => {
      message += `
* ${app.vaccine} `;
    });
    return message;
  } else return "";
};

const modifyCalendar = async (calendar) => {
  if (usr) {
    const appointments = (await getAllApointments(usr.dni)).filter(
      (app) => app.state !== "Pendiente"
    );
    appointments.map((app) => {
      let aux;
      const stringDate = app.vaccinationDate.toISOString().split("T", 1);
      calendar.reply_markup.inline_keyboard.map((a) => {
        const ab = a.findIndex(
          (b) => b.callback_data === `calendar-telegram-date-${stringDate}`
        );
        if (ab !== -1) {
          aux = ab;
        }
      });
      calendar.reply_markup.inline_keyboard.map((a) => {
        if (
          a[aux] &&
          a[aux].callback_data === `calendar-telegram-date-${stringDate}`
        ) {
          a[aux].text =
            app.vaccinationCenter === "Externo"
              ? "👍"
              : app.state === "Finalizado"
              ? "✅"
              : app.state === "Cancelado"
              ? "❌"
              : "⌛";
        }
      });
    });
    return calendar;
  }
};

module.exports = { sendMessage, modifyCalendar };

bot.launch();

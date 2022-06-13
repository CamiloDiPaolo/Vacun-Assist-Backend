const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // creamos un transportador
  // en este caso usamos: https://mailtrap.io/
  const transporter = nodemailer.createTransport({
    host: "smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: "dcb52998e47a4a",
      pass: "7c07f582c8f777",
    },
  });

  // definimos las opciones y enviamos el mail
  // ACA HAY QUE USAR LAS OPCIONES
  const mailOptions = {
    from: "Camilo Di Paolo <camilodipaolo8@gmail.com>",
    to: `yo mismo <${options.email}>`,
    subject: "VacunAssist",
    text: options.message,
    // html:
  };

  // 3) enviamos el mail
  await transporter.sendMail(mailOptions);
};

// sendEmail({ message: "hola q tal", email: "camilodipaolo8@gmail.com" });

module.exports = sendEmail;

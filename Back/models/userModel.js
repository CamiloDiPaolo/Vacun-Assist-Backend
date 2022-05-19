const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  dni: {
    type: String,
    required: [true, "Un usuario debe tener un dni"],
    unique: true,
  },
  password: {
    // agregar validacion para que sea mayor a 7 caracteres
    type: String,
    required: [true, "Un usuario debe tener una contraseña"],
    minlength: 8,
  },
  code: String,
  email: {
    type: String,

    required: [true, "Un usuario debe tener un mail"],
    lowercase: true,
  },
  emailsPlus: [
    {
      type: String,
      lowercase: true,
    },
  ],
  rol: {
    type: String,
    default: "user",
    enum: ["user", "vacc", "admin"],
  },
  vaccinationCenter: {
    // el vacunatorio solo cuenta para los usuarios con rol de Vacunador(vacc)
    // agregar un validador: si es rol vacc debe tener un vacunatorio asignado si o si
    type: String,
    enum: ["1", "2", "3"],
  },
  // healthData: {
  //   isRisk: { type: Boolean, default: false },
  //   anyCovidVaccine: { type: Boolean, default: false },
  //   lastCovidVaccineDate: { type: String, default: "" },
  //   fluVaccineYear: { type: String, default: "" },
  //   yellowFeverVaccine: { type: Boolean, default: false },
  //   updatedData: { type: Boolean, default: false },
  // },
  isRisk: Boolean,
  updatedHealthData: { type: Boolean, default: false },
  //////////////////////////////////////////////////////////////////////////////
  // COSAS AGREGADAS POR LA API DE RENAPER
  fullName: {
    type: String,
    required: [true, "Un usuario debe tener un nombre"],
    lowercase: true,
  },
  cuil: {
    type: String,
    required: [true, "Un usuario debe tener un cuil"],
    unique: true,
  },
  home: {
    street: {
      type: String,
      required: [true, "Un domiciolio debe tener una calle"],
      lowercase: true,
    },
    postalCode: {
      type: Number,
      required: [true, "Un domiciolio debe tener un codigo postal"],
    },
    state: {
      type: String,
      required: [true, "Un domiciolio debe tener una provincia"],
      lowercase: true,
    },
    number: {
      type: Number,
      required: [true, "Un domiciolio debe tener un numero"],
    },
  },
  birthday: {
    type: Date,
    required: [true, "Una persona tiene que haber nacido... no?"],
  },
});

const User = mongoose.model("users", userSchema);

module.exports = User;

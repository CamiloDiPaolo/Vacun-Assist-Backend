const mongoose = require("mongoose");

const appointmentSchema = mongoose.Schema({
  state: {
    type: String,
    default: "Activo",
    enum: ["Activo", "Finalizado", "Cancelado"],
  },
  patientDni: {
    type: Number,
  },
  vaccine: {
    type: String,
    required: [true, "Un turno debe tener una vacuna"],
    enum: ["FiebreAmarilla", "Covid1", "Covid2", "Covid3", "Gripe"],
  },
  vaccinatorDni: {
    type: Number,
  },
  vaccinationDate: {
    type: Date,
  },
  issueDate: {
    type: Date,
    default: Date.now(),
  },
  vaccinationCenter: {
    type: String,
    required: [true, "Un turno debe tener una vacunatorio"],
    enum: ["1", "2", "3"],
  },
});

const Appointment = mongoose.model("appointments", appointmentSchema);

module.exports = Appointment;

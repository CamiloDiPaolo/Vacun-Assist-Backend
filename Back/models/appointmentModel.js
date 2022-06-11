const mongoose = require("mongoose");

const appointmentSchema = mongoose.Schema({
  state: {
    type: String,
    default: "Activo",
    enum: ["Activo", "Finalizado", "Cancelado", "Pendiente", "Perdido"],
  },
  patientDni: {
    type: Number,
  },
  vaccine: {
    type: String,
    required: [true, "Un turno debe tener una vacuna"],
    enum: ["FiebreAmarilla", "Covid", "Gripe"],
  },
  vaccinatorDni: {
    type: Number,
  },
  vaccinationDate: {
    type: Date,
  },
  issueDate: {
    type: Date,
    // default: new Date().toDateString(),
    default: new Date(),
  },
  vaccinationCenter: {
    type: String,
    required: [true, "Un turno debe tener una vacunatorio"],
    enum: [
      "Hospital 9 de Julio",
      "Corralón municipal",
      "Polideportivo",
      "Externo",
    ],
  },
  lot: String,
  mark: String,
});

const Appointment = mongoose.model("appointments", appointmentSchema);

module.exports = Appointment;

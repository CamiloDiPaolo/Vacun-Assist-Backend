const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({
  vaccinationCenter: {
    type: String,
    required: true,
  },
  vaccine: {
    type: String,
    required: true,
  },
  cant: {
    type: Number,
    required: true,
    default: 0,
  },
});

const Stock = mongoose.model("stock", stockSchema);
module.exports = Stock;

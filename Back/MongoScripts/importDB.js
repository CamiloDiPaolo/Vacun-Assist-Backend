const mongoose = require("mongoose");
const fs = require("fs");
const User = require("./../models/userModel");
const Appointment = require("./../models/appointmentModel");
const Stock = require("./../models/stockModel");

const DB = "mongodb://127.0.0.1:27017/vacunAsist";

mongoose
  .connect(DB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    if (process.argv[2] === "import") {
      importData();
    } else if (process.argv[2] === "export") {
      exportData();
    } else if (process.argv[2] === "delete") {
      deleteData();
    }
    console.log("La conexion con la base de datos fue exitosa");
  });

const users = JSON.parse(
  fs.readFileSync(`${__dirname}/dataUser.json`, "utf-8")
);
const appointments = JSON.parse(
  fs.readFileSync(`${__dirname}/dataAppointment.json`, "utf-8")
);
const stocks = JSON.parse(
  fs.readFileSync(`${__dirname}/dataStocks.json`, "utf-8")
);

const deleteData = async () => {
  try {
    await User.deleteMany();
    await Appointment.deleteMany();
    await Stock.deleteMany();
    process.exit();
  } catch (err) {
    console.log(err);
  }
};
const exportData = async () => {
  try {
    const allUsers = await User.find();
    const allAppointments = await Appointment.find();
    const allStocks = await Stock.find();

    fs.writeFileSync(
      `${__dirname}/dataAppointment.json`,
      JSON.stringify(allAppointments)
    );
    fs.writeFileSync(`${__dirname}/dataUser.json`, JSON.stringify(allUsers));
    fs.writeFileSync(`${__dirname}/dataStocks.json`, JSON.stringify(allStocks));

    process.exit();
  } catch (err) {
    console.log(err);
  }
};
const importData = async () => {
  try {
    await User.create(users);
    await Appointment.create(appointments);
    await Stock.create(stocks);
    process.exit();
  } catch (err) {
    console.log(err);
  }
};

console.log(process.argv);

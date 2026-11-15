const mongoose=require("mongoose");

const equipmentSchema = new mongoose.Schema({
  name: String,
  category: String,
  department: String,
  description: String,
  specifications: String,
  location: String
});

const Equipment = mongoose.model("Equipment", equipmentSchema);
module.exports = Equipment;
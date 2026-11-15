// Inserts a few sample Equipment documents so the chatbot has something to answer from.
// Usage: npm run seed   (then restart the server or call GET /api/ingest)
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Equipment = require("./models/Equipment");

const samples = [
  { name: "Digital Oscilloscope", category: "Electronics Lab", department: "ECE", description: "4-channel bench oscilloscope", specifications: "200 MHz, 1 GSa/s", location: "ECE Block, Lab 2" },
  { name: "3D Printer", category: "Workshop", department: "Mechanical", description: "FDM printer for prototyping", specifications: "250x250x300 mm build volume, PLA/ABS", location: "Innovation Center" },
  { name: "GPU Server", category: "Computing", department: "CSE", description: "Server for deep learning workloads", specifications: "4x NVIDIA A100, 512 GB RAM", location: "CSE Block, Server Room" },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  if (await Equipment.countDocuments()) {
    console.log("Equipment collection already has data; skipping seed.");
  } else {
    await Equipment.insertMany(samples);
    console.log(`Seeded ${samples.length} equipment records.`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });

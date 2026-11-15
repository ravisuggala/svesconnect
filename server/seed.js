// Inserts sample equipment so the assistant has something to answer from. Usage: npm run seed
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
const pool = require("./db/pool");

const samples = [
  ["Digital Oscilloscope", "Electronics Lab", "ECE", "4-channel bench oscilloscope", "200 MHz, 1 GSa/s", "ECE Block, Lab 2"],
  ["3D Printer", "Workshop", "Mechanical", "FDM printer for prototyping", "250x250x300 mm build volume, PLA/ABS", "Innovation Center"],
  ["GPU Server", "Computing", "CSE", "Server for deep learning workloads", "4x NVIDIA A100, 512 GB RAM", "CSE Block, Server Room"],
];

(async () => {
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM equipment");
  if (n) console.log("Equipment table already has data; skipping seed.");
  else {
    await pool.query("INSERT INTO equipment (name, category, department, description, specifications, location) VALUES ?", [samples]);
    console.log(`Seeded ${samples.length} equipment records.`);
  }
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });

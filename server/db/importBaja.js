// Usage: npm run import:baja -- <sves-baja-backup.json> [--publish]
// Brings the old BAJA prototype's data (its "Export backup" JSON, files included) into the Events module:
// each college > year > folder becomes an event of type "competition", each file lands in its category folder with its summary.
// Safe to run twice: existing events and files are skipped. Add --publish to make the imported events public right away.
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });
const pool = require("./pool");
const { saveEventFile, cleanMeta, MIME } = require("../modules/events/routes");
const { findType } = require("../modules/events/typeSpec");

// College names used by the prototype -> college codes of SVES Connect.
const COLLEGE = { "SVECW": "VWU", "VIT B": "VIT", "VITB": "VIT", "VITS": "VIT", "BVRITH": "BVRITH", "BVRIT": "BVRIT" };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

async function main() {
  const file = process.argv[2];
  const publish = process.argv.includes("--publish");
  if (!file || !fs.existsSync(file)) { console.log("Usage: npm run import:baja -- <backup.json> [--publish]"); process.exit(1); }
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  if (d.app !== "sves-baja") throw new Error("This is not a BAJA prototype backup (expected app: sves-baja).");
  const type = findType("competition");
  const [colleges] = await pool.query("SELECT id, code, name FROM colleges");
  const byCode = Object.fromEntries(colleges.map((c) => [c.code, c]));
  const stats = { events: 0, files: 0, skipped: 0, noData: 0, badType: 0, noCollege: 0 };
  const events = new Map();

  for (const cat of d.categories || []) {
    const folderDef = type.folders.find((f) => f.name.toLowerCase() === String(cat.key).toLowerCase());
    for (const f of cat.files || []) {
      const code = COLLEGE[String(f.college || "").toUpperCase()] || (byCode[String(f.college || "").toUpperCase()] && String(f.college).toUpperCase());
      if (!code) { stats.noCollege++; console.log(`  skipped (unknown college "${f.college}"): ${f.name}`); continue; }
      if (!f.data) { stats.noData++; console.log(`  skipped (no file content in the backup): ${f.name}`); continue; }
      const name = f.fname || f.name || "file";
      const ext = path.extname(name).slice(1).toLowerCase();
      if (!MIME[ext]) { stats.badType++; console.log(`  skipped (file type .${ext} not allowed): ${name}`); continue; }
      const college = byCode[code];
      const evName = String(f.event || "BAJA").replace(/[_]+/g, " ").trim();
      const year = String(f.year || "").trim() || null;
      const key = `${college.id}|${year}|${evName}`;
      let ev = events.get(key);
      if (!ev) {
        const [[found]] = await pool.query("SELECT * FROM events WHERE college_id = ? AND name = ? AND (academic_year <=> ?)", [college.id, evName, year]);
        if (found) ev = found;
        else {
          const m = MONTHS.findIndex((mn) => evName.toLowerCase().includes(mn));
          const yr = (evName.match(/20\d{2}/) || [])[0];
          const date = [m >= 0 && MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1), yr].filter(Boolean).join(" ") || null;
          const [r] = await pool.query("INSERT INTO events (college_id, type_key, name, academic_year, event_date, status, published_at) VALUES (?,?,?,?,?,?,?)",
            [college.id, "competition", evName, year, date, publish ? "published" : "draft", publish ? new Date() : null]);
          [[ev]] = await pool.query("SELECT * FROM events WHERE id = ?", [r.insertId]);
          stats.events++;
        }
        events.set(key, ev);
      }
      const folder = folderDef ? folderDef.name : "Others";
      const [[dup]] = await pool.query("SELECT id FROM event_files WHERE event_id = ? AND folder = ? AND original_name = ?", [ev.id, folder, name]);
      if (dup) { stats.skipped++; continue; }
      const meta = cleanMeta({ folder, title: "", contributor: f.credit || f.contributor || f.by || "", fileDate: f.date || "" }, type);
      await saveEventFile(college, ev, { filename: name, buf: Buffer.from(f.data, "base64"), meta, uploadedBy: null });
      stats.files++;
    }
  }
  console.log(`Imported ${stats.files} files into ${stats.events} new events (${stats.skipped} already there${publish ? ", events published" : ", events left unpublished: open each and press Publish"}).`);
  if (stats.noData || stats.badType || stats.noCollege) console.log(`Not imported: ${stats.noData} without content, ${stats.badType} with a blocked type, ${stats.noCollege} with an unknown college.`);
  await pool.end();
}
main().catch((e) => { console.error("Import failed:", e.message); process.exit(1); });

// Usage: npm run import:motorsport -- --from <folder that contains "Vishnu Motorsports Directory 2"> [--no-publish] [--skip-cad] [--only-public]
// Loads data/motorsport/manifest.json into MySQL and copies the files into the Events storage layout:
//   STORAGE/events/<COLLEGE>/<academic year>/<id>-<event>/<folder>/<subsystem>/<file>
// Events with at least one public file are published (unless --no-publish). Safe to run again: nothing is duplicated.
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", ".env"), quiet: true });
const pool = require("../pool");
const { STORAGE, fileDir, slug } = require("../../modules/events/routes");

const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const flag = (k) => process.argv.includes(k);
const CAD = /\.(sldprt|sldasm|slddrw|sldalasm|igs|iges|step|stp|stl|x_t|catpart|catproduct|obj)$/i;

async function main() {
  const from = path.resolve(arg("--from") || "reference/connectfiles");
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "..", "data", "motorsport", "manifest.json"), "utf8"));
  const [colleges] = await pool.query("SELECT id, code FROM colleges");
  const byCode = Object.fromEntries(colleges.map((c) => [c.code, c]));
  const evRows = new Map();
  const st = { events: 0, files: 0, dup: 0, missing: 0, cadSkipped: 0, bytes: 0 };
  const publishable = new Set(manifest.files.filter((f) => f.isPublic).map((f) => f.eventKey));

  for (const e of manifest.events) {
    const college = byCode[e.college];
    if (!college) { console.log("  unknown college", e.college); continue; }
    let [[row]] = await pool.query("SELECT * FROM events WHERE college_id = ? AND name = ? AND (academic_year <=> ?)", [college.id, e.name, e.academicYear]);
    if (!row) {
      const pub = !flag("--no-publish") && publishable.has(e.key);
      const [r] = await pool.query("INSERT INTO events (college_id, type_key, name, academic_year, event_date, description, status, published_at) VALUES (?,?,?,?,?,?,?,?)",
        [college.id, "competition", e.name, e.academicYear, e.eventDate, e.description, pub ? "published" : "draft", pub ? new Date() : null]);
      [[row]] = await pool.query("SELECT * FROM events WHERE id = ?", [r.insertId]);
      st.events++;
    }
    evRows.set(e.key, { ev: row, college });
  }

  for (const f of manifest.files) {
    const hit = evRows.get(f.eventKey);
    if (!hit) continue;
    if (flag("--only-public") && !f.isPublic) { st.cadSkipped++; continue; }
    if (flag("--skip-cad") && CAD.test(f.originalName)) { st.cadSkipped++; continue; }
    const { ev, college } = hit;
    const [[dup]] = await pool.query("SELECT id FROM event_files WHERE event_id = ? AND folder = ? AND subfolder = ? AND original_name = ? AND size = ?", [ev.id, f.folder, f.subfolder, f.originalName, f.size]);
    if (dup) { st.dup++; continue; }
    const src = path.join(from, f.src);
    if (!fs.existsSync(src)) { st.missing++; if (st.missing <= 10) console.log("  missing:", f.src); continue; }
    const ext = path.extname(f.originalName).slice(1).toLowerCase();
    const dir = fileDir(college, ev, f.folder, f.subfolder);
    fs.mkdirSync(path.join(STORAGE, dir), { recursive: true });
    const stored = path.join(dir, `${crypto.randomBytes(6).toString("hex")}-${slug(path.basename(f.originalName, `.${ext}`))}.${ext}`);
    fs.copyFileSync(src, path.join(STORAGE, stored));
    await pool.query(
      "INSERT INTO event_files (event_id, folder, subfolder, title, description, contributor, file_date, tags, is_public, original_name, stored_name, mime, size, summary, extracted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [ev.id, f.folder, f.subfolder.slice(0, 80), f.title.slice(0, 200), f.description, f.contributor, f.fileDate, f.tags.join(","), f.isPublic ? 1 : 0, f.originalName.slice(0, 255), stored, f.mime, f.size, f.summary, f.extracted]);
    st.files++; st.bytes += f.size;
    if (st.files % 100 === 0) console.log(`  ${st.files} files copied…`);
  }
  console.log(`Events created: ${st.events}. Files loaded: ${st.files} (${(st.bytes / 1e9).toFixed(2)} GB); already there: ${st.dup}; missing at the source: ${st.missing}${st.cadSkipped ? `; not loaded (CAD / team-only by choice): ${st.cadSkipped}` : ""}.`);
  await pool.end();
}
main().catch((e) => { console.error("Import failed:", e.message); process.exit(1); });

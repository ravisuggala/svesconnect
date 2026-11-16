// Usage: node server/db/motorsport/prepare.js "<path to reference/connectfiles>"
// Reads the Vishnu Motorsports directories (college > year > event > subsystem > files) and writes
//   data/motorsport/manifest.json   events + one metadata record per file (title, folder, tags, summary, public or team-only ...)
//   data/motorsport/files-from.txt  the list of files to copy to the server (rsync --files-from)
// Nothing is uploaded here; the manifest is small and goes to git, the files travel by rsync (see DEPLOY.md).
const fs = require("fs");
const path = require("path");
const { extractText, summarize, clean } = require("../../modules/events/extract");

const ROOT = path.resolve(process.argv[2] || "reference/connectfiles");
const OUT = path.join(__dirname, "..", "..", "..", "data", "motorsport");
const TOPS = ["Vishnu Motorsports Directory", "Vishnu Motorsports Directory 2"];

const COLLEGE = [[/svecw/i, "VWU"], [/bvrith/i, "BVRITH"], [/bvrit/i, "BVRIT"], [/^vit/i, "VIT"]];
const IMG = ["jpg", "jpeg", "png", "gif", "webp"], DOC = ["pdf", "docx", "doc", "pptx", "ppt"], SHEET = ["xlsx", "xls", "csv"];
const CAD = ["sldprt", "sldasm", "slddrw", "sldalasm", "igs", "iges", "step", "stp", "stl", "x_t", "catpart", "catproduct", "obj"];
const MIME = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", zip: "application/zip" };
const SKIP_DIR = /proof of payment|installment|local market bills|local purchase/i;      // students' payment proofs, bills: never imported
const SENSITIVE = /invoice|indent|account|payment|purchase|quotation|installment|\bfees?\b|salary|bank|bill/i;
const MAX_PUBLIC = 60 * 1024 * 1024;

const VARIANTS = [[/e[\s_-]*ziba/i, "E-Ziba"], [/h[\s_-]*baja/i, "h-BAJA"], [/m[\s_-]*baja/i, "M-BAJA"], [/e[\s_-]*baja/i, "E-BAJA"], [/a[\s_-]*baja/i, "A-BAJA"], [/reev/i, "REEV"]];
const variantOf = (s) => (VARIANTS.find(([re]) => re.test(s)) || [])[1] || null;
const SUBSYSTEM = [[/brak/i, "Braking"], [/steer/i, "Steering"], [/suspens|wheel assembly/i, "Suspension"], [/power\s*train|drive\s*train|transmission/i, "Powertrain"], [/roll\s*cage|frame/i, "Roll cage & Frame"], [/overall|design$|assembly$|^design/i, "Overall"], [/ergonom/i, "Ergonomics"], [/bench/i, "Test bench"], [/packag/i, "Vehicle packaging"]];
const subsystemOf = (s) => (SUBSYSTEM.find(([re]) => re.test(s)) || [])[1] || s.replace(/^\d+\.\s*/, "").trim();
const titleCase = (s) => s.replace(/\w\S*/g, (w) => (w === w.toUpperCase() && w.length <= 5 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()));

function folderFor(ext, name) {
  const n = name.toLowerCase();
  if (IMG.includes(ext)) return "Photos";
  if (CAD.includes(ext)) return "Design";
  if (/drawing/.test(n)) return "Design";
  if (/calcul|\bcae\b|analysis|simulation|dfmea|dvp|justif|\bfea\b|validation/.test(n)) return "Design Considerations";
  if (/learning|outcome|feedback/.test(n)) return "Learning Outcomes";
  if (/challenge|failure|issue/.test(n)) return "Challenges Faced";
  if (ext === "zip") return "Others";
  return "Reports";
}
const KIND = { Photos: "photo", Design: "design / CAD file", "Design Considerations": "design analysis document", Reports: "report", Others: "archive", "Learning Outcomes": "learning outcomes", "Challenges Faced": "challenges note" };

function cleanTitle(base) {
  return base.replace(/^\d{5,7}[_\s-]+/, "").replace(/[_]+/g, " ").replace(/\s*\(\d+\)|\[\d+\]/g, "").replace(/\s+/g, " ").trim() || base;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.test(e.name)) walk(p, out); } else if (e.isFile()) out.push(p);
  }
  return out;
}

const events = new Map(), files = [], skipped = { junk: 0, sensitive: 0, type: 0, dup: 0 }, seen = new Set(), skippedList = [];
for (const top of TOPS) {
  const topDir = path.join(ROOT, top);
  if (!fs.existsSync(topDir)) continue;
  for (const abs of walk(topDir)) {
    const rel = path.relative(ROOT, abs);
    const parts = path.relative(topDir, abs).split(path.sep);
    const base = path.basename(abs), ext = path.extname(base).slice(1).toLowerCase();
    if (base.startsWith("~$") || base === ".DS_Store" || /^(lnk|log|wbpj|rd5|car|car2|p2s)$/.test(ext) || !ext) { skipped.junk++; continue; }
    if (![...IMG, ...DOC, ...SHEET, ...CAD, "zip"].includes(ext)) { skipped.type++; skippedList.push(rel); continue; }
    // Accounts, indents, payments and bills are never imported (private); they stay in the source folder only.
    if (SENSITIVE.test(path.basename(base, path.extname(base))) || SENSITIVE.test(parts.slice(0, -1).join("/"))) { skipped.sensitive++; skippedList.push(rel); continue; }
    const collegeDir = parts[0];
    const college = (COLLEGE.find(([re]) => re.test(collegeDir)) || [])[1];
    if (!college) continue;
    let inner = parts.slice(1, -1);                       // directories between the college and the file
    let year = null;
    if (/^\d{4}$/.test(inner[0] || "")) year = Number(inner.shift());
    else if (/^\d{4}\b/.test(inner[0] || "")) { year = Number(inner[0].slice(0, 4)); inner.shift(); }
    // event = the first directory that names a competition variant (E-BAJA, M-BAJA, REEV, A-BAJA, h-BAJA ...)
    let variant = null, evIdx = inner.findIndex((d) => variantOf(d));
    if (evIdx >= 0) { variant = variantOf(inner[evIdx]); const y = inner[evIdx].match(/20\d{2}/); if (!year && y) year = Number(y[0]); inner = inner.slice(evIdx + 1); }
    else if (inner.length) { const v = variantOf(collegeDir + " " + parts.join(" ")); variant = v; }
    if (!variant) variant = /20\d{2}/.test(base) || /ziba/i.test(base) ? "E-BAJA" : "Motorsports";
    // pass through "folder named like the event" levels (for example E-Baja / E baja 2026) and year-report wrappers
    while (inner.length && (variantOf(inner[0]) === variant || /^\d{4}_.*reports$/i.test(inner[0]) || /^[a-z]+_?baja\s*\d{4}$/i.test(inner[0]) || /^(a_baja|vit_hbaja|bvrith_\w+)/i.test(inner[0]))) {
      const y = inner[0].match(/20\d{2}/); if (!year && y) year = Number(y[0]); inner = inner.slice(1);
    }
    const subRaw = inner[0] || (variant === "E-BAJA" && /ziba/i.test(base) ? "Competition submission" : "Overall");
    const subsystem = subsystemOf(subRaw);
    const part = inner.slice(1).map((x) => x.trim()).filter(Boolean).join(" / ");
    const evKey = `${college}|${variant}|${year || "-"}`;
    const dupKey = `${evKey}|${subsystem}|${base}|${fs.statSync(abs).size}`;
    if (seen.has(dupKey)) { skipped.dup++; continue; }
    seen.add(dupKey);
    const st = fs.statSync(abs);
    if (!events.has(evKey)) events.set(evKey, { key: evKey, college, name: `${variant}${year ? ` ${year}` : ""}`, variant, year, academicYear: year ? `${year - 1}-${String(year).slice(2)}` : null, files: 0, subsystems: new Set() });
    const ev = events.get(evKey); ev.files++; ev.subsystems.add(subsystem);

    const stem = path.basename(base, path.extname(base));
    const folder = folderFor(ext, stem);
    const isPublic = st.size <= MAX_PUBLIC && (IMG.includes(ext) || DOC.includes(ext));
    let body = "";
    if (DOC.includes(ext) && st.size <= 80 * 1024 * 1024 && ["pdf", "docx", "pptx"].includes(ext)) body = extractText(fs.readFileSync(abs), ext);
    const summary = summarize(body, 2) || null;
    const team = (stem.match(/Team [A-Z][\w ]*?(?=[_(-])/) || [])[0] || (/amigos/i.test(stem) ? "Team Amigos" : "");
    const title = cleanTitle(stem);
    const tags = [...new Set([variant, year && String(year), subsystem, KIND[folder], ext.toUpperCase()].filter(Boolean))];
    files.push({
      src: rel, eventKey: evKey, folder, subfolder: subsystem, title,
      description: `${titleCase(subsystem)} ${KIND[folder]} for ${variant}${year ? ` ${year}` : ""}${part ? ` (${part})` : ""}.`,
      contributor: team || null, fileDate: new Date(st.mtime).toISOString().slice(0, 10), tags, isPublic, mime: MIME[ext] || "application/octet-stream", size: st.size,
      summary, extracted: clean(body).slice(0, 4000) || null, originalName: base,
    });
  }
}

const COLLEGE_NAME = { VWU: "Vishnu Women's University (SVECW)", VIT: "Vishnu Institute of Technology", BVRIT: "B. V. Raju Institute of Technology", BVRITH: "BVRIT Hyderabad College of Engineering for Women" };
const eventList = [...events.values()].map((e) => ({
  key: e.key, college: e.college, name: e.name, type: "competition", academicYear: e.academicYear, eventDate: e.year ? String(e.year) : null,
  description: `Design and competition records of the ${e.name} vehicle project of ${COLLEGE_NAME[e.college]}, covering ${[...e.subsystems].join(", ")}.`, files: e.files,
}));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ generatedFrom: "reference/connectfiles", events: eventList, files }, null, 1));
fs.writeFileSync(path.join(OUT, "files-public-from.txt"), files.filter((f) => f.isPublic).map((f) => f.src).join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "files-from.txt"), files.map((f) => f.src).join("\n") + "\n");
const gb = (b) => (b / 1e9).toFixed(2);
console.log(`${eventList.length} events, ${files.length} files (${gb(files.reduce((a, f) => a + f.size, 0))} GB; public ${files.filter((f) => f.isPublic).length} = ${gb(files.filter((f) => f.isPublic).reduce((a, f) => a + f.size, 0))} GB)`);
console.log("skipped:", JSON.stringify(skipped), skippedList.filter((x) => /account|indent|payment/i.test(x)).slice(0, 5));
for (const e of eventList) console.log(`  ${e.college.padEnd(7)} ${e.name.padEnd(18)} ${String(e.files).padStart(4)} files  ${e.academicYear || ""}`);

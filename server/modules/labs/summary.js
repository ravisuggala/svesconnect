// College-wide, equipment-wise public summaries. Numbers are always counted exactly from the approved records;
// the wording is written by the Groq model when a key is set (only from public facts, never finance or documents), otherwise by a plain template.
const crypto = require("crypto");
const axios = require("axios");
const pool = require("../../db/pool");
const { findTemplate } = require("./formSpec");

const nameKey = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 255);
const slug = (k) => k.replace(/ /g, "-");
const unslug = (s) => nameKey(String(s).replace(/-/g, " "));
const num = (v) => Number(v) || 0;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

// All approved equipment of one college, grouped by (normalised) name, with public facts only.
async function groups(collegeId) {
  const [rows] = await pool.query(
    `SELECT e.id, e.name, e.template_key, e.data, e.approved_at, l.id AS lab_id, l.name AS lab_name, l.department
       FROM equipment e JOIN labs l ON l.id = e.lab_id WHERE e.college_id = ? AND e.status = 'approved' ORDER BY e.name`, [collegeId]);
  const ids = rows.map((r) => r.id);
  const [photos] = ids.length ? await pool.query("SELECT equipment_id, MIN(id) AS id FROM equipment_files WHERE kind = 'photos' AND equipment_id IN (?) GROUP BY equipment_id", [ids]) : [[]];
  const photo = Object.fromEntries(photos.map((p) => [p.equipment_id, p.id]));
  const [cat] = await pool.query("SELECT name, name_key, purpose FROM equipment_catalog WHERE college_id = ?", [collegeId]);
  const catalogue = new Map(cat.map((c) => [c.name_key, c]));
  const map = new Map();
  for (const r of rows) {
    const d = r.data ? JSON.parse(r.data) : {};
    const key = nameKey(r.name);
    const g = map.get(key) || { key, slug: slug(key), name: catalogue.get(key)?.name || r.name, purpose: catalogue.get(key)?.purpose || "", types: {}, units: 0, working: 0, workingKnown: true, departments: {}, labs: [], brands: {}, courses: new Set(), specs: {}, years: [], photoId: null };
    const qty = Math.max(1, Math.floor(num(d.quantity) || 1));
    const type = findTemplate(r.template_key)?.label || "Other";
    g.types[type] = (g.types[type] || 0) + 1;
    g.units += qty;
    if (d.units_working !== undefined) g.working += num(d.units_working);
    else if (d.current_status === "Working") g.working += qty;
    else if (d.current_status) g.workingKnown = g.workingKnown && true;
    else g.workingKnown = false;
    g.departments[r.department] = (g.departments[r.department] || 0) + qty;
    g.labs.push({ equipmentId: r.id, labId: r.lab_id, lab: r.lab_name, department: r.department, units: qty, working: d.units_working !== undefined ? num(d.units_working) : d.current_status === "Working" ? qty : null, brand: [d.manufacturer, d.model].filter(Boolean).join(" "), year: d.year_bought || "" });
    const b = [d.manufacturer, d.model].filter(Boolean).join(" ");
    if (b) g.brands[b] = (g.brands[b] || 0) + qty;
    if (d.courses_using) for (const c of String(d.courses_using).split(/\n|;/).map((x) => x.trim()).filter(Boolean)) g.courses.add(c.slice(0, 120));
    for (const row of Array.isArray(d.spec_rows) ? d.spec_rows : []) if (row.k && row.v) { const t = `${row.k}: ${row.v}`; g.specs[t] = (g.specs[t] || 0) + 1; }
    if (num(d.year_bought) > 1980) g.years.push(num(d.year_bought));
    if (!g.photoId && photo[r.id]) g.photoId = photo[r.id];
    if (!g.purpose && d.description) g.purpose = String(d.description);
    map.set(key, g);
  }
  return [...map.values()].map((g) => ({
    key: g.key, slug: g.slug, name: g.name, purpose: g.purpose,
    type: Object.entries(g.types).sort((a, b) => b[1] - a[1])[0][0],
    units: g.units, working: g.workingKnown ? g.working : null,
    labCount: g.labs.length,
    departments: Object.entries(g.departments).map(([department, units]) => ({ department, units })).sort((a, b) => b.units - a.units),
    labs: g.labs.sort((a, b) => a.department.localeCompare(b.department) || a.lab.localeCompare(b.lab)),
    brands: Object.entries(g.brands).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, units]) => ({ name, units })),
    courses: [...g.courses].slice(0, 8),
    specs: Object.entries(g.specs).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t),
    yearFrom: g.years.length ? Math.min(...g.years) : null, yearTo: g.years.length ? Math.max(...g.years) : null,
    photoId: g.photoId,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// What the writer (template or AI) may use: public facts only.
const factsOf = (college, g) => ({
  college: college.name, equipment: g.name, type: g.type, purpose: g.purpose, totalUnits: g.units, workingUnits: g.working,
  labs: g.labCount, unitsByDepartment: g.departments, brandsAndModels: g.brands.map((b) => `${b.name} (${b.units})`), yearsBought: g.yearFrom ? (g.yearFrom === g.yearTo ? `${g.yearFrom}` : `${g.yearFrom}-${g.yearTo}`) : null,
  usedForCourses: g.courses, mainSpecifications: g.specs,
});

function templateSummary(college, g) {
  const depts = g.departments.map((d) => `${d.department} (${d.units})`).join(", ");
  const parts = [`${g.name} is available at ${college.name}: ${g.units} unit${g.units === 1 ? "" : "s"} in ${g.labCount} lab${g.labCount === 1 ? "" : "s"}${g.working !== null ? `, of which ${g.working} ${g.working === 1 ? "is" : "are"} working` : ""}.`];
  if (g.purpose) parts.push(`It is used for ${g.purpose.replace(/^(to |for )/i, "").replace(/[.\s]+$/, "")}.`);
  if (depts) parts.push(`Units by department: ${depts}.`);
  if (g.brands.length) parts.push(`Makes and models: ${g.brands.map((b) => b.name).join(", ")}.`);
  if (g.courses.length) parts.push(`Used in: ${g.courses.slice(0, 4).join("; ")}.`);
  return parts.join(" ");
}

async function askLLM(facts) {
  if (!process.env.GROK_API_KEY) return null;
  const prompt = `Write a clear, friendly summary (3 to 5 sentences, plain text) of one piece of college equipment for the public website.\n` +
    `Use ONLY the facts below. Do not invent anything. Mention the total units, the departments that have it, and what it is used for. Do not mention prices, vendors or documents.\n\nFACTS (JSON):\n${JSON.stringify(facts)}`;
  try {
    const r = await axios.post("https://api.groq.com/openai/v1/chat/completions",
      { model: GROQ_MODEL, messages: [{ role: "system", content: "You write short, accurate descriptions of college laboratory equipment." }, { role: "user", content: prompt }], temperature: 0.3, max_tokens: 350 },
      { headers: { Authorization: `Bearer ${process.env.GROK_API_KEY}`, "Content-Type": "application/json" }, timeout: 20000 });
    const t = String(r.data.choices?.[0]?.message?.content || "").trim();
    return t.length > 40 ? t : null;
  } catch (err) { console.error("Groq summary error:", err.response?.data || err.message); return null; }
}

const busy = new Set();
// Returns the text to show now. When the facts changed it returns the template wording at once and rewrites the AI text in the background.
async function summaryFor(college, g) {
  const facts = factsOf(college, g);
  const hash = crypto.createHash("sha1").update(JSON.stringify(facts)).digest("hex");
  const [[row]] = await pool.query("SELECT facts_hash, summary, source FROM equipment_summaries WHERE college_id = ? AND name_key = ?", [college.id, g.key]);
  if (row && row.facts_hash === hash) return { text: row.summary, source: row.source };
  const text = templateSummary(college, g);
  const id = `${college.id}:${g.key}`;
  if (process.env.GROK_API_KEY && !busy.has(id)) {
    busy.add(id);
    askLLM(facts).then(async (ai) => {
      await pool.query("REPLACE INTO equipment_summaries (college_id, name_key, facts_hash, summary, source) VALUES (?,?,?,?,?)", [college.id, g.key, hash, ai || text, ai ? "ai" : "template"]);
    }).catch(() => {}).finally(() => busy.delete(id));
  } else if (!process.env.GROK_API_KEY) {
    await pool.query("REPLACE INTO equipment_summaries (college_id, name_key, facts_hash, summary, source) VALUES (?,?,?,?,?)", [college.id, g.key, hash, text, "template"]);
  }
  return { text, source: "template" };
}

module.exports = { nameKey, slug, unslug, groups, summaryFor };

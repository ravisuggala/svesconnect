// Module 2 core: one search index over departments, labs and equipment.
// Same approach as the original assistant (embeddings + cosine ranking, answers from an LLM) but:
//  - scoped by who is asking (public sees only published; HOD their department; Principal their college),
//  - works without the embedding library or an LLM key (keyword ranking fallback), so search never depends on either.
const pool = require("../../db/pool");
const { buildSpec, templateList } = require("../labs/formSpec");

let embedder = null;
let embedderState = "unknown"; // unknown | ok | failed
let entries = [];
let vectors = new Map(); // text -> embedding, reused between rebuilds so only changed records are re-embedded
let timer = null;
let building = null;

async function getEmbedder() {
  if (process.env.DISABLE_EMBEDDINGS === "1" || embedderState === "failed") return null;
  if (embedder) return embedder;
  try {
    // Loaded lazily: the site must still run if this optional library (or its native sharp binary) is unavailable.
    const { pipeline } = require("@xenova/transformers");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    embedderState = "ok";
    return embedder;
  } catch (e) {
    embedderState = "failed";
    console.log("Semantic search unavailable, using keyword search:", String(e.message).split("\n")[0]);
    return null;
  }
}
async function embed(text, fresh) {
  const m = await getEmbedder();
  if (!m) return null;
  if (vectors.has(text)) { const v = vectors.get(text); fresh.set(text, v); return v; }
  const out = await m(text, { pooling: "mean", normalize: true });
  const v = Array.from(out.data);
  fresh.set(text, v);
  return v;
}

const val = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === "object" ? `${x.k}: ${x.v}` : x)).join("; ") : v);
// Only non-financial details go into the index (the same text may be shown to the public).
function equipmentText(row, data) {
  const tpl = templateList().find((t) => t.key === row.template_key);
  const spec = buildSpec(row.template_key);
  const lines = [
    `College: ${row.college_name}`, `Department: ${row.department}`, `Lab: ${row.lab_name}`, `Equipment: ${row.name}`, `Type: ${tpl?.label || ""}`,
  ];
  const add = (label, key) => { const v = val(data[key]); if (v !== undefined && v !== "" && v !== null) lines.push(`${label}: ${v}`); };
  for (const [l, k] of [["Manufacturer", "manufacturer"], ["Model", "model"], ["Description", "description"], ["Key features", "key_features"], ["Applications", "applications"], ["Primary application", "primary_application"],
    ["Specifications", "detailed_specifications"], ["Specification table", "spec_rows"], ["Operating range", "operating_range"], ["Accuracy", "accuracy"], ["Location", "location_facility"], ["Building", "building"], ["Room", "room"],
    ["Status", "current_status"], ["Courses", "courses_using"], ["Research projects", "research_projects"], ["Accessibility", "accessibility"], ["Contact", "contact_name"]]) add(l, k);
  const tsec = spec.sections.find((s) => s.key === "template");
  if (tsec) for (const f of tsec.fields) add(f.label, f.key);
  return lines.join("\n");
}

async function build() {
  const [labs] = await pool.query(
    `SELECT l.id, l.college_id, l.department, l.name, l.description, l.building, l.floor, l.room, l.accessibility, c.code AS college_code, c.name AS college_name, u.name AS coordinator
       FROM labs l JOIN colleges c ON c.id = l.college_id LEFT JOIN users u ON u.id = l.incharge_user_id`);
  const [eq] = await pool.query(
    `SELECT e.id, e.lab_id, e.college_id, e.department, e.template_key, e.name, e.status, e.data, l.name AS lab_name, c.code AS college_code, c.name AS college_name
       FROM equipment e JOIN labs l ON l.id = e.lab_id JOIN colleges c ON c.id = e.college_id WHERE e.status IN ('approved', 'submitted')`);
  const out = [];
  const labStat = new Map();
  for (const e of eq) {
    const data = e.data ? JSON.parse(e.data) : {};
    const text = equipmentText(e, data);
    out.push({ kind: "equipment", id: e.id, collegeId: e.college_id, collegeCode: e.college_code, department: e.department, labId: e.lab_id, status: e.status, publicOk: e.status === "approved",
      title: e.name, subtitle: `${e.lab_name} · ${e.department} · ${e.college_code}`, snippet: String(data.description || data.key_features || "").slice(0, 180), text, lower: text.toLowerCase(), titleLower: e.name.toLowerCase() });
    const ls = labStat.get(e.lab_id) || { approved: 0, pending: 0, names: [] }; ls[e.status === "approved" ? "approved" : "pending"]++; if (ls.names.length < 25) ls.names.push(e.name); labStat.set(e.lab_id, ls);
  }
  const byDept = new Map();
  for (const l of labs) {
    const s = labStat.get(l.id) || { approved: 0, pending: 0, names: [] };
    const where = [l.building, l.floor && `Floor ${l.floor}`, l.room && `Room ${l.room}`].filter(Boolean).join(", ");
    const text = [`College: ${l.college_name}`, `Department: ${l.department}`, `Lab: ${l.name}`, l.description && `About the lab: ${l.description}`, where && `Location: ${where}`, l.accessibility && `Access: ${l.accessibility}`,
      l.coordinator && `Coordinator: ${l.coordinator}`, `Published equipment: ${s.approved}`, s.names.length ? `Equipment in this lab: ${s.names.join("; ")}` : ""].filter(Boolean).join("\n");
    out.push({ kind: "lab", id: l.id, collegeId: l.college_id, collegeCode: l.college_code, department: l.department, labId: l.id, status: null, publicOk: s.approved > 0,
      title: l.name, subtitle: `${l.department} · ${l.college_code}`, snippet: String(l.description || `${s.approved} published equipment`).slice(0, 180), text, lower: text.toLowerCase(), titleLower: l.name.toLowerCase() });
    const key = `${l.college_id}|${l.department}`;
    const d = byDept.get(key) || { collegeId: l.college_id, collegeCode: l.college_code, collegeName: l.college_name, department: l.department, labs: [], approved: 0 };
    d.labs.push(l.name); d.approved += s.approved; byDept.set(key, d);
  }
  for (const d of byDept.values()) {
    const text = `College: ${d.collegeName}\nDepartment: ${d.department}\nLabs in this department: ${d.labs.join("; ")}\nPublished equipment: ${d.approved}`;
    out.push({ kind: "department", id: `${d.collegeCode}:${d.department}`, collegeId: d.collegeId, collegeCode: d.collegeCode, department: d.department, labId: null, status: null, publicOk: d.approved > 0,
      title: `${d.department} department`, subtitle: `${d.labs.length} labs · ${d.collegeCode}`, snippet: `Labs: ${d.labs.slice(0, 6).join(", ")}`, text, lower: text.toLowerCase(), titleLower: d.department.toLowerCase() });
  }
  const fresh = new Map();
  for (const en of out) en.vector = await embed(en.text, fresh);
  vectors = fresh;
  entries = out;
  return entries.length;
}

/** Rebuild now (startup / manual). Concurrent calls share one run. */
function refresh() {
  if (!building) building = build().finally(() => { building = null; });
  return building;
}
/** Call after any change to labs or equipment; the index is rebuilt shortly after (changes are batched). */
function touch() {
  clearTimeout(timer);
  timer = setTimeout(() => refresh().catch((e) => console.log("Search index refresh failed:", e.message)), 1500);
}

// ---------- scope ----------
// { mode: 'public' } | { mode: 'all' } | { mode: 'college', collegeId, department?, labId? }
function allowed(en, scope) {
  if (scope.mode === "public") return en.publicOk;
  if (scope.mode === "all") return true;
  if (en.collegeId !== scope.collegeId) return false;
  if (scope.labId) return (en.kind === "lab" && en.id === scope.labId) || (en.kind === "equipment" && en.labId === scope.labId);
  if (scope.department) return en.department === scope.department;
  return true;
}

// ---------- ranking ----------
const STOP = new Set("the a an of in on for and or to is are was were be do does did have has with from by me my us we our i it its this that these those what which who whom where when how show list give tell find get any all some please about there their at as".split(" "));
const tokens = (q) => String(q).toLowerCase().replace(/[^a-z0-9+#.\- ]+/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));
function keywordScore(en, toks) {
  let score = 0, hit = 0;
  for (const t of toks) {
    let s = 0;
    if (en.titleLower.includes(t)) s += 5;
    if (en.subtitle.toLowerCase().includes(t)) s += 2;
    const c = en.lower.split(t).length - 1;
    if (c) s += Math.min(c, 3);
    if (s) hit++;
    score += s;
  }
  return toks.length && hit === toks.length ? score * 1.5 : score; // reward matching every word
}
function cosine(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; } // vectors are normalised

const queryVectors = new Map();
async function search(query, scope, limit = 10) {
  const pool_ = entries.filter((en) => allowed(en, scope));
  const toks = tokens(query);
  let qv = null;
  if (embedderState !== "failed") {
    try {
      const m = await getEmbedder();
      if (m) {
        qv = queryVectors.get(query);
        if (!qv) { qv = Array.from((await m(query, { pooling: "mean", normalize: true })).data); if (queryVectors.size > 500) queryVectors.clear(); queryVectors.set(query, qv); }
      }
    } catch { qv = null; }
  }
  const scored = pool_.map((en) => {
    const kw = keywordScore(en, toks);
    const sem = qv && en.vector ? cosine(qv, en.vector) : null;
    return { en, kw, sem, score: sem !== null ? sem + 0.03 * Math.min(kw, 12) : kw };
  }).filter((r) => (r.sem !== null ? r.sem >= 0.34 || r.kw > 0 : r.kw > 0));
  scored.sort((a, b) => b.score - a.score);
  return { mode: qv ? "semantic" : "keyword", results: scored.slice(0, limit).map((r) => r.en) };
}

const size = () => entries.length;
const mode = () => (embedderState === "ok" ? "semantic" : embedderState === "failed" || process.env.DISABLE_EMBEDDINGS === "1" ? "keyword" : "pending");

// Link for a result, depending on whether the viewer is looking at published pages or their own college's records.
function linkFor(en, scope) {
  const c = en.collegeCode.toLowerCase();
  if (scope.mode === "public") return en.kind === "equipment" ? `/explore/equipment/${en.id}` : en.kind === "lab" ? `/explore/lab/${en.id}` : `/explore/c/${c}/d/${encodeURIComponent(en.department)}`;
  return en.kind === "equipment" ? `/c/${c}/equipment/${en.id}` : en.kind === "lab" ? `/c/${c}/lab-details/${en.id}` : `/c/${c}/lab-details?dept=${encodeURIComponent(en.department)}`;
}
const present = (en, scope) => ({ kind: en.kind, id: en.id, title: en.title, subtitle: en.subtitle, snippet: en.snippet, status: en.status, url: linkFor(en, scope) });

module.exports = { refresh, touch, search, present, size, mode };

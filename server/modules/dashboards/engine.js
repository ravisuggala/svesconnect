// Dashboard engine: loads one college's facts (scoped to who is asking) and answers STRUCTURED requests exactly.
// The AI never touches the database; it only turns a sentence into a request that is validated here (see ask.js).
// New data sources (research, projects, ...) are added by registering another entity in ENTITIES.
const pool = require("../../db/pool");
const { findTemplate } = require("../labs/formSpec");

const num = (v) => Number(v) || 0;
const low = (v) => String(v ?? "").toLowerCase();
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const monthName = (i) => MONTHS[i - 1][0].toUpperCase() + MONTHS[i - 1].slice(1);
const STATUS_LABEL = { draft: "Draft", submitted: "Awaiting HOD", rejected: "Sent back", approved: "Published" };

function scopeOf(me, college) {
  if (me.role === "hod") return { dept: me.department || "__none__", collegeId: college.id };
  return { dept: null, collegeId: college.id };
}

function conditionOf(d, q) {
  if (d.units_working !== undefined) { const c = d.condition || {}; return { working: num(d.units_working), repair: num(c.repair), notInUse: num(c.unused), unknown: 0 }; }
  const s = d.current_status;
  if (s === "Working") return { working: q, repair: 0, notInUse: 0, unknown: 0 };
  if (s === "Under repair" || s === "Under maintenance") return { working: 0, repair: q, notInUse: 0, unknown: 0 };
  if (s === "Down") return { working: 0, repair: 0, notInUse: q, unknown: 0 };
  return { working: 0, repair: 0, notInUse: 0, unknown: q };
}
const costOf = (d) => (d.total_cost !== "" && d.total_cost !== undefined && Number.isFinite(Number(d.total_cost)) ? Number(d.total_cost) : d.equipment_cost_lakhs ? Math.round(Number(d.equipment_cost_lakhs) * 100000) : 0);

async function loadFacts(me, college) {
  const sc = scopeOf(me, college);
  const dw = sc.dept ? " AND l.department = ?" : "";
  const dp = sc.dept ? [sc.collegeId, sc.dept] : [sc.collegeId];
  const [eq] = await pool.query(
    `SELECT e.id, e.name, e.template_key, e.status, e.data, e.pub_data, e.created_at, e.approved_at, l.id AS lab_id, l.name AS lab_name, l.department, l.building, l.floor, l.room, u.name AS incharge, u.email AS incharge_email
       FROM equipment e JOIN labs l ON l.id = e.lab_id LEFT JOIN users u ON u.id = l.incharge_user_id WHERE l.college_id = ?${dw}`, dp);
  const [labs] = await pool.query(`SELECT l.id, l.name, l.department, l.building, l.floor, l.room, u.id AS uid, u.name AS incharge, u.email AS incharge_email, u.status AS ustatus FROM labs l LEFT JOIN users u ON u.id = l.incharge_user_id WHERE l.college_id = ?${dw}`, dp);
  const [hods] = await pool.query(`SELECT id, name, email, department, status FROM users WHERE college_id = ? AND role = 'hod'${sc.dept ? " AND department = ?" : ""} ORDER BY department`, dp);
  const [events] = await pool.query(`SELECT e.id, e.name, e.type_key, e.department, e.academic_year, e.event_date, e.venue, e.status, e.created_at, (SELECT COUNT(*) FROM event_files f WHERE f.event_id = e.id) AS files FROM events e WHERE e.college_id = ?${sc.dept ? " AND e.department = ?" : ""} ORDER BY e.created_at DESC`, dp);
  const equipment = eq.map((r) => {
    const d = r.data ? JSON.parse(r.data) : {};
    const q = Math.max(1, Math.floor(num(d.quantity) || 1));
    const c = conditionOf(d, q);
    const published = !!r.pub_data;
    return { id: r.id, name: r.name, type: findTemplate(r.template_key)?.label || "Other", department: r.department, lab: r.lab_name, labId: r.lab_id, incharge: r.incharge || "", inchargeEmail: r.incharge_email || "",
      location: [r.building, r.floor && `Floor ${r.floor}`, r.room && `Room ${r.room}`].filter(Boolean).join(", "), units: q, ...c, brand: [d.manufacturer, d.model].filter(Boolean).join(" "),
      year: num(d.year_bought) || null, added: r.created_at, approved: r.approved_at, cost: costOf(d), status: r.status, published,
      statusLabel: published ? (r.status === "approved" ? "Published" : "Published, changes pending") : STATUS_LABEL[r.status] || r.status, purpose: d.description || "", warrantyYears: num(d.warranty_years), amcEnd: d.amc_end || "" };
  });
  return { sc, equipment, labs, hods, events };
}

// ---------- filtering ----------
const eventYM = (e) => {
  const t = String(e.event_date || ""); const y = t.match(/\b(20\d\d)\b/); const m = MONTHS.findIndex((n) => low(t).includes(n.slice(0, 3)));
  const c = new Date(e.created_at);
  return { y: y ? Number(y[1]) : c.getFullYear(), m: m >= 0 ? m + 1 : y ? 0 : c.getMonth() + 1 };
};
const inDateWindow = (date, f) => {
  const d = new Date(date); if (Number.isNaN(d.getTime())) return !(f.year || f.month || f.from || f.to);
  if (f.year && d.getFullYear() !== f.year) return false;
  if (f.month && d.getMonth() + 1 !== f.month) return false;
  if (f.from && d < new Date(f.from)) return false;
  if (f.to && d > new Date(`${f.to}T23:59:59`)) return false;
  return true;
};
const hasEquipmentFilter = (f) => !!(f.type || f.condition || f.status || f.q || f.boughtFrom || f.boughtTo || f.year || f.month || f.from || f.to || f.lab || f.equipment);
function filterEquipment(rows, f) {
  const q = low(f.q);
  return rows.filter((r) => {
    if (f.department && low(r.department) !== low(f.department)) return false;
    if (f.lab && !low(r.lab).includes(low(f.lab))) return false;
    if (f.incharge && !low(r.incharge).includes(low(f.incharge))) return false;
    if (f.type && low(r.type) !== low(f.type)) return false;
    if (f.equipment && !low(r.name).includes(low(f.equipment))) return false;
    if (q && !low(`${r.name} ${r.type} ${r.brand} ${r.purpose} ${r.lab} ${r.department}`).includes(q)) return false;
    if (f.condition === "working" && !(r.working > 0)) return false;
    if (f.condition === "repair" && !(r.repair > 0)) return false;
    if (f.condition === "not_in_use" && !(r.notInUse > 0)) return false;
    if (f.condition === "not_working" && !(r.repair + r.notInUse > 0)) return false;
    if (f.status === "published" && !r.published) return false;
    if (f.status === "pending" && r.status !== "submitted") return false;
    if (f.status === "draft" && r.status !== "draft") return false;
    if (f.status === "sent_back" && r.status !== "rejected") return false;
    if (f.boughtFrom && !(r.year && r.year >= f.boughtFrom)) return false;
    if (f.boughtTo && !(r.year && r.year <= f.boughtTo)) return false;
    if ((f.year || f.month || f.from || f.to) && !inDateWindow(r.added, f)) return false;
    return true;
  });
}

// ---------- aggregation ----------
const blankAgg = () => ({ records: 0, units: 0, working: 0, repair: 0, notInUse: 0, unknown: 0, cost: 0, published: 0, pending: 0 });
function addTo(a, r) { a.records++; a.units += r.units; a.working += r.working; a.repair += r.repair; a.notInUse += r.notInUse; a.unknown += r.unknown; a.cost += r.cost; if (r.published) a.published++; if (r.status === "submitted") a.pending++; return a; }
const GROUP_KEY = {
  department: (r) => r.department, lab: (r) => `${r.lab} (${r.department})`, type: (r) => r.type, equipment: (r) => r.name, incharge: (r) => r.incharge || "(no in-charge)",
  year: (r) => (r.year ? String(r.year) : "Year not given"), month: (r) => { const d = new Date(r.added); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; },
};
const GROUP_LABEL = { department: "Department", lab: "Lab", type: "Type", equipment: "Equipment", incharge: "Lab in-charge", year: "Year bought", month: "Month added" };

const C = (key, label, extra = {}) => ({ key, label, ...extra });
const METRIC_COLS = (finance) => [C("units", "Units", { num: true }), C("working", "Working", { num: true }), C("repair", "Needs repair", { num: true }), C("notInUse", "Not in use", { num: true }), ...(finance ? [C("cost", "Cost", { money: true })] : [])];
const sumTotals = (rows, keys) => Object.fromEntries(keys.map((k) => [k, rows.reduce((t, r) => t + num(r[k]), 0)]));

function runEquipment(facts, req, finance) {
  const rows = filterEquipment(facts.equipment, req.filters);
  if (req.groupBy && GROUP_KEY[req.groupBy]) {
    const m = new Map();
    for (const r of rows) { const k = GROUP_KEY[req.groupBy](r); m.set(k, addTo(m.get(k) || { label: k, ...blankAgg() }, r)); }
    const out = [...m.values()].sort((a, b) => (req.groupBy === "month" || req.groupBy === "year" ? a.label.localeCompare(b.label) : b.units - a.units));
    return { columns: [C("label", GROUP_LABEL[req.groupBy]), C("records", "Equipment", { num: true }), ...METRIC_COLS(finance)], rows: out, totals: sumTotals(out, ["records", "units", "working", "repair", "notInUse", ...(finance ? ["cost"] : [])]) };
  }
  const out = rows.map((r) => ({ ...r, cost: r.cost || 0 })).sort((a, b) => a.department.localeCompare(b.department) || a.lab.localeCompare(b.lab) || a.name.localeCompare(b.name));
  return { columns: [C("name", "Equipment"), C("type", "Type"), C("department", "Department"), C("lab", "Lab"), C("incharge", "In-charge"), C("units", "Units", { num: true }), C("working", "Working", { num: true }), C("repair", "Needs repair", { num: true }), C("notInUse", "Not in use", { num: true }),
    C("brand", "Make / model"), C("year", "Year"), C("statusLabel", "Status"), ...(finance ? [C("cost", "Cost", { money: true })] : [])], rows: out, totals: sumTotals(out, ["units", "working", "repair", "notInUse", ...(finance ? ["cost"] : [])]) };
}

function runGrouped(facts, req, finance, kind) { // labs | incharges | departments
  const eqf = hasEquipmentFilter(req.filters);
  const eq = filterEquipment(facts.equipment, { ...req.filters, department: undefined, lab: undefined, incharge: undefined });
  const keyOf = { labs: (l) => l.id, incharges: (l) => l.uid || `lab${l.id}`, departments: (l) => l.department }[kind];
  const groups = new Map();
  for (const l of facts.labs) {
    if (req.filters.department && low(l.department) !== low(req.filters.department)) continue;
    if (req.filters.lab && !low(l.name).includes(low(req.filters.lab))) continue;
    if (req.filters.incharge && !low(l.incharge).includes(low(req.filters.incharge))) continue;
    const k = keyOf(l);
    const g = groups.get(k) || { label: kind === "departments" ? l.department : kind === "incharges" ? (l.incharge || "(no in-charge)") : l.name, department: l.department, email: l.incharge_email || "", incharge: l.incharge || "", labs: [], location: [l.building, l.floor && `Floor ${l.floor}`, l.room && `Room ${l.room}`].filter(Boolean).join(", "), ...blankAgg(), labIds: new Set() };
    g.labs.push(l.name); g.labIds.add(l.id); groups.set(k, g);
  }
  for (const r of eq) for (const g of groups.values()) if (g.labIds.has(r.labId)) addTo(g, r);
  let out = [...groups.values()].filter((g) => !eqf || g.records > 0).map((g) => ({ ...g, labs: g.labs.length, labNames: g.labs.join(", ") }));
  if (kind === "departments") { const ev = new Map(); for (const e of facts.events) ev.set(e.department, (ev.get(e.department) || 0) + 1); out = out.map((g) => ({ ...g, events: ev.get(g.department) || 0 })); }
  out.sort((a, b) => (kind === "labs" ? a.department.localeCompare(b.department) || a.label.localeCompare(b.label) : kind === "incharges" ? a.label.localeCompare(b.label) : a.label.localeCompare(b.label)));
  const base = kind === "labs"
    ? [C("label", "Lab"), C("department", "Department"), C("incharge", "In-charge"), C("location", "Location")]
    : kind === "incharges" ? [C("label", "Lab in-charge"), C("email", "Email"), C("department", "Department"), C("labNames", "Lab")]
      : [C("label", "Department"), C("labs", "Labs", { num: true }), C("events", "Events", { num: true })];
  return { columns: [...base, C("records", "Equipment", { num: true }), ...METRIC_COLS(finance), C("published", "Published", { num: true }), C("pending", "Awaiting HOD", { num: true })], rows: out,
    totals: sumTotals(out, ["records", "units", "working", "repair", "notInUse", "published", "pending", ...(finance ? ["cost"] : [])]) };
}

function runHods(facts, req, finance) {
  const f = req.filters; const q = low(f.q);
  const hods = facts.hods.filter((h) => (!f.department || low(h.department) === low(f.department)) && (!q || low(`${h.name} ${h.email} ${h.department}`).includes(q)));
  const out = hods.map((h) => { const a = blankAgg(); for (const r of facts.equipment) if (r.department === h.department) addTo(a, r); return { name: h.name, email: h.email, department: h.department, status: h.status === "active" ? "Active" : "Disabled", labs: facts.labs.filter((l) => l.department === h.department).length, ...a }; });
  return { columns: [C("name", "HOD"), C("email", "Email"), C("department", "Department"), C("status", "Login"), C("labs", "Labs", { num: true }), C("records", "Equipment", { num: true }), C("units", "Units", { num: true }), C("working", "Working", { num: true }), C("repair", "Needs repair", { num: true }), C("pending", "Awaiting approval", { num: true }), ...(finance ? [C("cost", "Cost", { money: true })] : [])],
    rows: out, totals: sumTotals(out, ["labs", "records", "units", "working", "repair", "pending", ...(finance ? ["cost"] : [])]) };
}

function runEvents(facts, req) {
  const f = req.filters; const q = low(f.q);
  let rows = facts.events.filter((e) => {
    if (f.department && low(e.department) !== low(f.department)) return false;
    if (f.status === "published" && e.status !== "published") return false;
    if (f.status === "draft" && e.status !== "draft") return false;
    if (q && !low(`${e.name} ${e.type_key} ${e.venue} ${e.academic_year} ${e.event_date}`).includes(q)) return false;
    const ym = eventYM(e);
    if (f.year && ym.y !== f.year) return false;
    if (f.month && ym.m !== f.month) return false;
    if (f.from && ym.y < new Date(f.from).getFullYear()) return false;
    if (f.to && ym.y > new Date(f.to).getFullYear()) return false;
    return true;
  }).map((e) => ({ name: e.name, type: e.type_key, department: e.department || "College level", year: e.academic_year || "", date: e.event_date || "", venue: e.venue || "", status: e.status === "published" ? "Published" : "Draft", files: Number(e.files) || 0 }));
  if (req.groupBy === "month" || req.groupBy === "year" || req.groupBy === "department") {
    const m = new Map(); const evs = facts.events.filter((e) => rows.some((r) => r.name === e.name));
    for (const e of evs) { const ym = eventYM(e); const k = req.groupBy === "department" ? e.department || "College level" : req.groupBy === "year" ? String(ym.y) : `${ym.y}-${String(ym.m || 1).padStart(2, "0")}`; const g = m.get(k) || { label: k, records: 0, files: 0 }; g.records++; g.files += Number(e.files) || 0; m.set(k, g); }
    const out = [...m.values()].sort((a, b) => a.label.localeCompare(b.label));
    return { columns: [C("label", GROUP_LABEL[req.groupBy] || "Group"), C("records", "Events", { num: true }), C("files", "Files", { num: true })], rows: out, totals: sumTotals(out, ["records", "files"]) };
  }
  return { columns: [C("name", "Event"), C("type", "Type"), C("department", "Department"), C("year", "Academic year"), C("date", "Date"), C("venue", "Venue"), C("status", "Status"), C("files", "Files", { num: true })], rows, totals: { records: rows.length } };
}

const ENTITIES = {
  equipment: { label: "Equipment", run: runEquipment },
  labs: { label: "Labs", run: (f, r, fin) => runGrouped(f, r, fin, "labs") },
  incharges: { label: "Lab in-charges (faculty)", run: (f, r, fin) => runGrouped(f, r, fin, "incharges") },
  departments: { label: "Departments", run: (f, r, fin) => runGrouped(f, r, fin, "departments") },
  hods: { label: "Heads of Department", run: runHods },
  events: { label: "Events", run: (f, r) => runEvents(f, r) },
  // research / projects: register here when those modules exist
};

// Sentence describing what a request means (shown to the user so they can check it).
function describe(req) {
  const f = req.filters, bits = [];
  if (f.department) bits.push(`Department: ${f.department}`);
  if (f.lab) bits.push(`Lab: ${f.lab}`);
  if (f.incharge) bits.push(`In-charge: ${f.incharge}`);
  if (f.type) bits.push(`Type: ${f.type}`);
  if (f.equipment) bits.push(`Equipment: ${f.equipment}`);
  if (f.condition) bits.push({ working: "Condition: working", repair: "Condition: needs repair", not_in_use: "Condition: not in use", not_working: "Condition: not working (repair or not in use)" }[f.condition]);
  if (f.status) bits.push({ published: "Published", pending: "Awaiting HOD approval", draft: "Draft", sent_back: "Sent back" }[f.status]);
  if (f.boughtFrom || f.boughtTo) bits.push(`Bought ${f.boughtFrom ? `from ${f.boughtFrom}` : ""}${f.boughtFrom && f.boughtTo ? " " : ""}${f.boughtTo ? `to ${f.boughtTo}` : ""}`.trim());
  const dateBasis = req.entity === "events" ? "Event date" : "Added to portal";
  if (f.year) bits.push(`${dateBasis}: ${f.month ? `${monthName(f.month)} ` : ""}${f.year}`); else if (f.month) bits.push(`${dateBasis}: ${monthName(f.month)}`);
  if (f.from || f.to) bits.push(`${dateBasis}: ${f.from || "…"} to ${f.to || "…"}`);
  if (f.q) bits.push(`Containing “${f.q}”`);
  if (req.groupBy) bits.push(`Grouped by ${low(GROUP_LABEL[req.groupBy])}`);
  return bits;
}
const title = (req, rows) => `${ENTITIES[req.entity].label}${req.groupBy ? ` by ${low(GROUP_LABEL[req.groupBy])}` : ""} (${rows} ${req.groupBy ? "groups" : "records"})`;

async function run(me, college, request, finance) {
  const facts = await loadFacts(me, college);
  const req = normalize(request, facts);
  const out = ENTITIES[req.entity].run(facts, req, finance);
  return { request: req, understood: describe(req), title: title(req, out.rows.length), entityLabel: ENTITIES[req.entity].label, ...out, rows: out.rows.slice(0, 1000), truncated: out.rows.length > 1000 };
}

// Whitelist everything: anything unknown is dropped, so a bad AI answer can never run anything unexpected.
const FILTER_STR = ["department", "lab", "incharge", "type", "equipment", "q"];
function normalize(r, facts) {
  r = r && typeof r === "object" ? r : {};
  const entity = ENTITIES[r.entity] ? r.entity : "equipment";
  const f = r.filters && typeof r.filters === "object" ? r.filters : {};
  const out = {};
  for (const k of FILTER_STR) if (f[k] !== undefined && f[k] !== null && String(f[k]).trim()) out[k] = String(f[k]).trim().slice(0, 120);
  if (out.department) { const m = [...new Set([...facts.labs.map((l) => l.department), ...facts.hods.map((h) => h.department)])].find((d) => low(d) === low(out.department) || low(d).includes(low(out.department)) || low(out.department).includes(low(d))); if (m) out.department = m; }
  if (["working", "repair", "not_in_use", "not_working"].includes(f.condition)) out.condition = f.condition;
  if (["published", "pending", "draft", "sent_back"].includes(f.status)) out.status = f.status;
  for (const k of ["year", "boughtFrom", "boughtTo"]) { const v = Math.floor(num(f[k])); if (v >= 1950 && v <= 2100) out[k] = v; }
  const m = Math.floor(num(f.month)); if (m >= 1 && m <= 12) out.month = m;
  for (const k of ["from", "to"]) if (/^\d{4}-\d{2}-\d{2}$/.test(String(f[k] || ""))) out[k] = f[k];
  const groupBy = GROUP_KEY[r.groupBy] ? r.groupBy : null;
  return { entity, filters: out, groupBy: ["equipment", "events"].includes(entity) || groupBy ? groupBy : null };
}

// ---------- dashboard ----------
async function dashboard(me, college) {
  const facts = await loadFacts(me, college);
  const eq = facts.equipment;
  const tot = eq.reduce((a, r) => addTo(a, r), blankAgg());
  const byDept = new Map();
  for (const l of facts.labs) byDept.set(l.department, byDept.get(l.department) || { department: l.department, labs: 0, units: 0, published: 0, pending: 0, draft: 0 });
  for (const l of facts.labs) byDept.get(l.department).labs++;
  for (const r of eq) { const d = byDept.get(r.department) || { department: r.department, labs: 0, units: 0, published: 0, pending: 0, draft: 0 }; d.units += r.units; if (r.published) d.published++; else if (r.status === "submitted") d.pending++; else d.draft++; byDept.set(r.department, d); }
  const series = (keyFn, valFn = (r) => r.units) => { const m = new Map(); for (const r of eq) { const k = keyFn(r); if (k) m.set(k, (m.get(k) || 0) + valFn(r)); } return [...m].map(([label, value]) => ({ label, value })); };
  const today = new Date(); const soon = new Date(today.getTime() + 90 * 86400000);
  const alerts = [];
  const amc = eq.filter((r) => r.amcEnd && new Date(r.amcEnd) >= today && new Date(r.amcEnd) <= soon);
  if (amc.length) alerts.push({ tone: "warning", text: `${amc.length} AMC contract${amc.length > 1 ? "s" : ""} ending within 90 days`, ask: "equipment under AMC ending soon" });
  const warr = eq.filter((r) => r.year && r.warrantyYears && r.year + r.warrantyYears === today.getFullYear());
  if (warr.length) alerts.push({ tone: "warning", text: `${warr.length} equipment ${warr.length > 1 ? "have" : "has"} warranty ending this year`, ask: "" });
  const nopub = facts.labs.filter((l) => !eq.some((r) => r.labId === l.id && r.published));
  if (nopub.length) alerts.push({ tone: "info", text: `${nopub.length} lab${nopub.length > 1 ? "s have" : " has"} nothing published yet`, ask: "labs with no published equipment" });
  if (tot.pending) alerts.push({ tone: "warning", text: `${tot.pending} equipment waiting for HOD approval`, ask: "equipment awaiting HOD approval" });
  if (tot.repair + tot.notInUse) alerts.push({ tone: "error", text: `${tot.repair + tot.notInUse} units are under repair or not in use`, ask: "not working equipment by department" });
  const evMonth = new Map(); for (const e of facts.events) { const ym = eventYM(e); const k = `${ym.y}-${String(ym.m || 1).padStart(2, "0")}`; evMonth.set(k, (evMonth.get(k) || 0) + 1); }
  const top = (arr, n) => arr.sort((a, b) => b.value - a.value).slice(0, n);
  return {
    college: { name: college.name, code: college.code }, scope: facts.sc.dept ? `Department: ${facts.sc.dept}` : "Whole college",
    tiles: { departments: byDept.size, labs: facts.labs.length, hods: facts.hods.length, inCharges: new Set(facts.labs.filter((l) => l.uid).map((l) => l.uid)).size, equipment: tot.records, units: tot.units, working: tot.working, repair: tot.repair, notInUse: tot.notInUse, notRecorded: tot.unknown,
      published: tot.published, pending: tot.pending, investment: tot.cost, events: facts.events.length, publishedEvents: facts.events.filter((e) => e.status === "published").length },
    unitsByDepartment: top(series((r) => r.department), 12), topTypes: top(series((r) => r.type), 8), topEquipment: top(series((r) => r.name), 8),
    boughtPerYear: series((r) => r.year, (r) => r.units).sort((a, b) => a.label - b.label).map((x) => ({ label: String(x.label), value: x.value })),
    approval: [...byDept.values()].sort((a, b) => a.department.localeCompare(b.department)),
    eventsByMonth: [...evMonth].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([label, value]) => ({ label, value })),
    alerts,
  };
}

async function options(me, college) {
  const facts = await loadFacts(me, college);
  const years = [...new Set(facts.equipment.map((r) => r.year).filter(Boolean))].sort();
  return { departments: [...new Set(facts.labs.map((l) => l.department))].sort(), labs: facts.labs.map((l) => ({ name: l.name, department: l.department })), types: [...new Set(facts.equipment.map((r) => r.type))].sort(),
    names: [...new Set(facts.equipment.map((r) => r.name))].sort(), years, entities: Object.entries(ENTITIES).map(([key, e]) => ({ key, label: e.label })) };
}

module.exports = { run, dashboard, options, loadFacts, normalize, describe, ENTITIES, MONTHS };

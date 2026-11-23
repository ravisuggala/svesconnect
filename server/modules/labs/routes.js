// Lab equipment module: labs (college > department > lab), the dynamic registration form, the approval chain and public lab pages.
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pool = require("../../db/pool");
const { collegeContext } = require("../../core/college");
const searchIndex = () => require("../search/index"); // lazy: keeps the index optional and avoids load-order issues
const summary = require("./summary");
const nameKey = summary.nameKey;
const { buildSpec, templateList, categoryList, isCurrent, findTemplate, missingRequired, allowedKeys, isVisible, FILE_KINDS } = require("./formSpec");

const STORAGE = process.env.STORAGE_DIR || path.join(__dirname, "..", "..", "..", "storage");
const MAX_FILE = 8 * 1024 * 1024;
const EXT = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
const kindOk = (k) => FILE_KINDS.some((x) => x.key === k);

// What the public may see: no finance, warranty/AMC, internal files or known issues.
const PUBLIC_SECTIONS = ["basic", "technical", "template", "operations", "usage", "contact"];
const PUBLIC_HIDDEN_KEYS = new Set(["equipment_cost_lakhs", "known_issues", "warranty_years", "total_cost"]);
const PUBLIC_FILE_KINDS = ["photos"]; // uploaded documents are never public; only the equipment photo is

const parse = (row) => ({ ...row, data: row.data ? JSON.parse(row.data) : {} });
const n = (v) => Number(v) || 0;

// ---------- value cleaning ----------
function cleanValue(field, v) {
  if (v === null || v === undefined) return "";
  switch (field.type) {
    case "number": { const x = String(v).trim(); return x === "" ? "" : Number.isFinite(Number(x)) ? Number(x) : ""; }
    case "list": return (Array.isArray(v) ? v : String(v).split("\n")).map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 50);
    case "kv": return (Array.isArray(v) ? v : []).map((r) => ({ k: String(r?.k || "").trim().slice(0, 120), v: String(r?.v || "").trim().slice(0, 300) })).filter((r) => r.k || r.v).slice(0, 60);
    case "counts": {
      const o = v && typeof v === "object" ? v : {};
      const i = (x) => Math.max(0, Math.floor(Number(x) || 0));
      const out = { repair: i(o.repair), unused: i(o.unused), note: String(o.note || "").trim().slice(0, 300) };
      return out.repair || out.unused || out.note ? out : "";
    }
    case "yesno": return ["Yes", "No"].includes(v) ? v : "";
    case "select": return field.options.includes(v) ? v : "";
    default: return String(v).trim().slice(0, 5000);
  }
}
function cleanData(spec, incoming) {
  const byKey = new Map([["name", { key: "name", type: "text" }], ...spec.sections.flatMap((s) => s.fields.map((f) => [f.key, f]))]);
  const out = {};
  for (const [k, v] of Object.entries(incoming || {})) if (byKey.has(k)) out[k] = cleanValue(byKey.get(k), v);
  return out;
}
// Values worked out from the answers, so every page and report counts the same way (current form only).
function derive(tplKey, d) {
  if (!isCurrent(tplKey)) return d;
  const qty = Math.max(1, Math.floor(Number(d.quantity) || 1));
  d.quantity = qty;
  const c = d.condition && typeof d.condition === "object" ? d.condition : {};
  const repair = Math.min(qty, Math.max(0, Math.floor(Number(c.repair) || 0)));
  const unused = Math.min(qty - repair, Math.max(0, Math.floor(Number(c.unused) || 0)));
  d.condition = repair || unused || c.note ? { repair, unused, note: c.note || "" } : "";
  d.units_working = qty - repair - unused;
  d.current_status = repair + unused === 0 ? "Working" : d.units_working > 0 ? "Partly working" : repair >= unused ? "Under repair" : "Not in use";
  if (d.total_cost !== "" && d.total_cost !== undefined && Number.isFinite(Number(d.total_cost))) d.equipment_cost_lakhs = Math.round((Number(d.total_cost) / 100000) * 10000) / 10000; else delete d.equipment_cost_lakhs;
  return d;
}
const specText = (d) => [d.detailed_specifications, ...(d.spec_rows || []).map((r) => `${r.k}: ${r.v}`)].filter(Boolean).join("\n");
const locationText = (d) => [d.location_facility, d.building, d.floor && `Floor ${d.floor}`, d.room && `Room ${d.room}`].filter(Boolean).join(", ");

// ---------- scope ----------
function labScope(me, college) {
  if (me.role === "admin" || me.role === "principal") return { where: "l.college_id = ?", params: [college.id] };
  if (me.role === "hod") return me.department ? { where: "l.college_id = ? AND l.department = ?", params: [college.id, me.department] } : null;
  if (me.role === "lab_incharge") return me.lab_id ? { where: "l.id = ? AND l.college_id = ?", params: [me.lab_id, college.id] } : null;
  return null;
}
async function loadLab(req, id) {
  const sc = labScope(req.me, req.college);
  if (!sc) return null;
  const [[lab]] = await pool.query(`SELECT l.* FROM labs l WHERE ${sc.where} AND l.id = ?`, [...sc.params, Number(id)]);
  return lab || null;
}
async function loadEquipment(req, id) {
  const sc = labScope(req.me, req.college);
  if (!sc) return null;
  const [[row]] = await pool.query(`SELECT e.*, l.name AS lab_name, l.department AS lab_department FROM equipment e JOIN labs l ON l.id = e.lab_id WHERE ${sc.where} AND e.id = ?`, [...sc.params, Number(id)]);
  return row ? parse(row) : null;
}
const isOwner = (me, eq) => me.role === "lab_incharge" && me.lab_id === eq.lab_id;
const editable = (eq) => ["draft", "rejected"].includes(eq.status);
// The in-charge of the lab may edit at any time (changes to published equipment wait for the HOD); the HOD of the department and the administrator may edit too.
const canEdit = (me, eq) => isOwner(me, eq) || me.role === "admin" || (me.role === "hod" && eq.lab_department === me.department);
const ROLE_LABEL = { lab_incharge: "Lab in-charge", hod: "HOD", admin: "Administrator", principal: "Principal" };
async function logHistory(eqId, me, action, detail) {
  await pool.query("INSERT INTO equipment_history (equipment_id, user_id, user_name, role, action, detail) VALUES (?,?,?,?,?,?)", [eqId, me.id, me.name || "", ROLE_LABEL[me.role] || me.role, action, String(detail || "").slice(0, 1500) || null]);
}
// Autosave edits are merged into one history line per person per 30 minutes.
async function logEdit(eqId, me, labels) {
  const [[last]] = await pool.query("SELECT id, detail FROM equipment_history WHERE equipment_id = ? AND user_id = ? AND action = 'edited' AND created_at > (NOW() - INTERVAL 30 MINUTE) ORDER BY id DESC LIMIT 1", [eqId, me.id]);
  if (last) {
    const merged = [...new Set([...(last.detail ? last.detail.split(", ") : []), ...labels])].join(", ");
    await pool.query("UPDATE equipment_history SET detail = ?, created_at = NOW() WHERE id = ?", [merged.slice(0, 1500), last.id]);
  } else await logHistory(eqId, me, "edited", labels.join(", "));
}

// ---------- college-scoped router ----------
const collegeRouter = express.Router({ mergeParams: true });
collegeRouter.use(collegeContext);

collegeRouter.get("/labs", async (req, res) => {
  const sc = labScope(req.me, req.college);
  if (!sc) return res.json({ labs: [] });
  const [rows] = await pool.query(
    `SELECT l.id, l.department, l.name, l.description, l.building, l.floor, l.room, l.accessibility,
            u.name AS coordinator, u.email AS coordinatorEmail,
            COUNT(e.id) AS total, SUM(e.status = 'draft') AS draft, SUM(e.status = 'submitted') AS submitted,
            SUM(e.pub_data IS NOT NULL) AS approved, SUM(e.status = 'rejected') AS rejected
       FROM labs l LEFT JOIN users u ON u.id = l.incharge_user_id LEFT JOIN equipment e ON e.lab_id = l.id
      WHERE ${sc.where} GROUP BY l.id, u.name, u.email ORDER BY l.department, l.name`, sc.params);
  res.json({ labs: rows.map((r) => ({ ...r, total: n(r.total), draft: n(r.draft), submitted: n(r.submitted), approved: n(r.approved), rejected: n(r.rejected) })) });
});

// Common information across the labs the caller may see (HOD: own department, Principal/admin: whole college), grouped by department.
collegeRouter.get("/overview", async (req, res) => {
  if (!["hod", "principal", "admin"].includes(req.me.role)) return res.status(403).json({ error: "Not allowed." });
  const sc = labScope(req.me, req.college);
  if (!sc) return res.json({ departments: [], totals: {}, types: [] });
  const [labs] = await pool.query(`SELECT l.id, l.department FROM labs l WHERE ${sc.where}`, sc.params);
  const [rows] = await pool.query(`SELECT l.department, e.lab_id, e.status, e.template_key, e.data, e.pub_data FROM equipment e JOIN labs l ON l.id = e.lab_id WHERE ${sc.where}`, sc.params);
  const labels = Object.fromEntries(templateList().map((t) => [t.key, t.label]));
  const blank = (department) => ({ department, labs: 0, published: 0, awaiting: 0, sentBack: 0, drafts: 0, working: 0, notWorking: 0, highValue: 0, investmentLakhs: 0 });
  const depts = new Map(), types = new Map();
  for (const l of labs) { const d = depts.get(l.department) || blank(l.department); d.labs++; depts.set(l.department, d); }
  for (const r of rows) {
    const d = depts.get(r.department) || blank(r.department); depts.set(r.department, d);
    if (r.status === "draft") d.drafts++; else if (r.status === "submitted") d.awaiting++; else if (r.status === "rejected") d.sentBack++;
    if (!r.pub_data) continue;
    d.published++;
    const data = JSON.parse(r.pub_data);
    if (data.current_status === "Working") d.working++; else if (data.current_status) d.notWorking++;
    const cost = n(data.equipment_cost_lakhs); d.investmentLakhs += cost; if (cost > 1.5) d.highValue++;
    types.set(labels[r.template_key] || "Other", (types.get(labels[r.template_key] || "Other") || 0) + 1);
  }
  const departments = [...depts.values()].map((d) => ({ ...d, investmentLakhs: Math.round(d.investmentLakhs * 100) / 100 })).sort((a, b) => a.department.localeCompare(b.department));
  const sum = (k) => departments.reduce((t, d) => t + d[k], 0);
  res.json({ departments, totals: { departments: departments.length, labs: sum("labs"), published: sum("published"), awaiting: sum("awaiting"), working: sum("working"), notWorking: sum("notWorking"), investmentLakhs: Math.round(sum("investmentLakhs") * 100) / 100 },
    types: [...types].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count) });
});

collegeRouter.get("/labs/:id", async (req, res) => {
  const lab = await loadLab(req, req.params.id);
  if (!lab) return res.status(404).json({ error: "Lab not found." });
  const [rows] = await pool.query("SELECT id, name, template_key AS templateKey, status, (pub_data IS NOT NULL) AS published, review_note AS reviewNote, JSON_UNQUOTE(JSON_EXTRACT(data, '$.variant')) AS variant, updated_at AS updatedAt FROM equipment WHERE lab_id = ? ORDER BY name, updated_at DESC", [lab.id]);
  res.json({ lab, equipment: rows, templates: templateList(), categories: categoryList() });
});

collegeRouter.patch("/labs/:id", async (req, res) => {
  const lab = await loadLab(req, req.params.id);
  if (!lab || !(req.me.role === "lab_incharge" && req.me.lab_id === lab.id)) return res.status(403).json({ error: "Only the lab coordinator can edit the lab profile." });
  const b = req.body || {};
  const t = (v, m) => String(v ?? "").trim().slice(0, m);
  await pool.query("UPDATE labs SET description = ?, building = ?, floor = ?, room = ?, accessibility = ?, contact_name = ?, contact_email = ?, contact_phone = ? WHERE id = ?", [t(b.description, 3000), t(b.building, 120), t(b.floor, 60), t(b.room, 60), t(b.accessibility, 60), t(b.contact_name, 160), t(b.contact_email, 190), t(b.contact_phone, 40), lab.id]);
  searchIndex().touch();
  res.json({ ok: true });
});

// ---------- equipment catalogue (name + purpose, shared by the whole college) ----------

collegeRouter.get("/catalog", async (req, res) => {
  const k = nameKey(req.query.q);
  if (!k) return res.json({ items: [] });
  const like = k.replace(/[\\%_]/g, "\\$&");
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.purpose, c.type_key AS typeKey, (SELECT COUNT(DISTINCT e.lab_id) FROM equipment e WHERE e.college_id = c.college_id AND LOWER(e.name) = LOWER(c.name)) AS labs
       FROM equipment_catalog c WHERE c.college_id = ? AND (c.name_key LIKE ? OR c.name_key LIKE ?)
      ORDER BY (c.name_key LIKE ?) DESC, c.name LIMIT 8`,
    [req.college.id, `${like}%`, `% ${like}%`, `${like}%`]);
  res.json({ items: rows.map((r) => ({ ...r, labs: Number(r.labs) || 0 })) });
});

collegeRouter.post("/labs/:id/equipment", async (req, res) => {
  const lab = await loadLab(req, req.params.id);
  if (!lab || !(req.me.role === "lab_incharge" && req.me.lab_id === lab.id)) return res.status(403).json({ error: "Only the lab coordinator can add equipment." });
  const { templateKey, name, purpose } = req.body || {};
  const variant = String(req.body?.variant || "").trim().slice(0, 160);
  let nm = String(name || "").trim().replace(/\s+/g, " ").slice(0, 255);
  if (nm.length < 2) return res.status(400).json({ error: "Please type the name of the equipment.", fields: { name: "Please type the name of the equipment." } });
  // The college catalogue: reuse an existing name (keeps spelling, type and purpose the same everywhere) or add this one for everybody.
  const key = nameKey(nm);
  const [found] = await pool.query("SELECT id, name, purpose, type_key FROM equipment_catalog WHERE college_id = ? AND name_key = ?", [req.college.id, key]);
  const known = found[0];
  // The same equipment may be added again in one lab (for example desktops with different configurations); the optional "configuration" tells them apart.
  let why = String(purpose || "").trim().slice(0, 1000);
  let type = String(templateKey || "");
  if (known) { nm = known.name; if (!why) why = known.purpose || ""; if (known.type_key && isCurrent(known.type_key)) type = known.type_key; }
  if (!isCurrent(type)) return res.status(400).json({ error: "Please choose what kind of equipment this is.", fields: { templateKey: "Please choose what kind of equipment this is." } });
  if (why.length < 3) return res.status(400).json({ error: "Please write a short line on what it is used for.", fields: { purpose: "Please write a short line on what it is used for." } });
  const tpl = findTemplate(type);
  if (!known) await pool.query("INSERT IGNORE INTO equipment_catalog (college_id, name, name_key, purpose, type_key, created_by, department) VALUES (?,?,?,?,?,?,?)", [req.college.id, nm, key, why, type, req.me.id, lab.department]);
  else if (!known.purpose || !known.type_key) await pool.query("UPDATE equipment_catalog SET purpose = COALESCE(NULLIF(purpose, ''), ?), type_key = COALESCE(type_key, ?) WHERE id = ?", [why, type, known.id]);
  const data = derive(type, { name: nm, description: why, variant, quantity: 1, contact_name: req.me.name, contact_email: req.me.email, contact_department: lab.department });
  const [r] = await pool.query(
    "INSERT INTO equipment (college_id, lab_id, department, template_key, name, category, data, status, created_by) VALUES (?,?,?,?,?,?,?, 'draft', ?)",
    [req.college.id, lab.id, lab.department, tpl.key, nm, tpl.label, JSON.stringify(data), req.me.id]);
  res.status(201).json({ id: r.insertId, existing: !!known });
});

// Everything entered for one lab, for the in-charge's / HOD's / Principal's printed copy (internal: includes purchase and service details).
collegeRouter.get("/labs/:id/record", async (req, res) => {
  const lab = await loadLab(req, req.params.id);
  if (!lab) return res.status(404).json({ error: "Lab not found." });
  const [[c]] = await pool.query("SELECT name, COALESCE(NULLIF(address, ''), CONCAT_WS(', ', name, city)) AS address FROM colleges WHERE id = ?", [req.college.id]);
  const [rows] = await pool.query("SELECT * FROM equipment WHERE lab_id = ? ORDER BY name", [lab.id]);
  const ids = rows.map((r) => r.id);
  const [files] = ids.length ? await pool.query("SELECT id, equipment_id, kind, original_name AS name, size FROM equipment_files WHERE equipment_id IN (?) ORDER BY id", [ids]) : [[]];
  const [hist] = ids.length ? await pool.query("SELECT equipment_id, user_name AS who, role, action, detail, created_at AS at FROM equipment_history WHERE equipment_id IN (?) ORDER BY id DESC", [ids]) : [[]];
  res.json({ lab, college: c,
    can: { approve: (req.me.role === "hod" && lab.department === req.me.department) || req.me.role === "admin", edit: req.me.role === "hod" || req.me.role === "admin" },
    equipment: rows.map((r) => { const eq = parse(r); const spec = buildSpec(eq.template_key); return { id: eq.id, name: eq.name, status: eq.status, published: !!r.pub_data, reviewNote: eq.review_note, type: spec.template?.label, data: eq.data, sections: spec.sections.filter((s) => !s.files || s.fields.length), files: files.filter((f) => f.equipment_id === eq.id), history: hist.filter((h) => h.equipment_id === eq.id).slice(0, 6) }; }) });
});

// Final approval of a whole lab: everything the in-charge has sent (new equipment and changes) goes live together. Items sent back stay as they are.
collegeRouter.post("/labs/:id/approve", async (req, res) => {
  const lab = await loadLab(req, req.params.id);
  if (!lab || !(req.me.role === "admin" || (req.me.role === "hod" && lab.department === req.me.department))) return res.status(403).json({ error: "Only the HOD of this department can approve the lab." });
  const [ready] = await pool.query("SELECT id FROM equipment WHERE lab_id = ? AND status = 'submitted'", [lab.id]);
  if (!ready.length) return res.status(400).json({ error: "Nothing is waiting for approval in this lab. The in-charge has to send equipment to the HOD first." });
  await pool.query("UPDATE equipment SET status = 'approved', pub_data = data, approved_by = ?, approved_at = NOW(), review_note = NULL WHERE lab_id = ? AND status = 'submitted'", [req.me.id, lab.id]);
  for (const r of ready) await logHistory(r.id, req.me, "approved", "Lab approved");
  await pool.query("UPDATE labs SET approved_at = NOW(), approved_by = ? WHERE id = ?", [req.me.id, lab.id]);
  searchIndex().touch();
  res.json({ ok: true, approved: ready.length });
});

// ---------- internal reports (HOD: own department, Principal/administrator: whole college). Finance is included here and never public. ----------
const costOf = (d) => (Number.isFinite(Number(d.total_cost)) && d.total_cost !== "" && d.total_cost !== undefined ? Number(d.total_cost) : d.equipment_cost_lakhs ? Math.round(Number(d.equipment_cost_lakhs) * 100000) : null);
const unitsOf = (d) => Math.max(1, Math.floor(n(d.quantity) || 1));
const workingOf = (d, q) => (d.units_working !== undefined ? n(d.units_working) : d.current_status === "Working" ? q : null);
function reportRow(r) {
  const d = r.data ? JSON.parse(r.data) : {};
  const q = unitsOf(d);
  return { id: r.id, name: r.name, type: findTemplate(r.template_key)?.label || "", status: r.status, published: !!r.pub_data, department: r.department, lab: r.lab_name, labId: r.lab_id,
    location: [r.building, r.floor && `Floor ${r.floor}`, r.room && `Room ${r.room}`].filter(Boolean).join(", "), quantity: q, working: workingOf(d, q), brand: [d.manufacturer, d.model].filter(Boolean).join(" "), year: d.year_bought || "", cost: costOf(d), purpose: d.description || "" };
}
const reportSql = (sc) => `SELECT e.id, e.name, e.template_key, e.status, e.data, e.pub_data, l.id AS lab_id, l.name AS lab_name, l.department, l.building, l.floor, l.room
  FROM equipment e JOIN labs l ON l.id = e.lab_id WHERE ${sc.where} ORDER BY l.department, l.name, e.name`;

collegeRouter.get("/report/labs", async (req, res) => {
  if (!["hod", "principal", "admin"].includes(req.me.role)) return res.status(403).json({ error: "Not allowed." });
  const sc = labScope(req.me, req.college);
  if (!sc) return res.json({ labs: [], departments: [] });
  const dept = String(req.query.department || "");
  const [labs] = await pool.query(`SELECT l.id, l.department, l.name, l.description, l.building, l.floor, l.room, l.accessibility, l.approved_at AS approvedAt, u.name AS coordinator, u.email AS coordinatorEmail
    FROM labs l LEFT JOIN users u ON u.id = l.incharge_user_id WHERE ${sc.where} ORDER BY l.department, l.name`, sc.params);
  const [rows] = await pool.query(reportSql(sc), sc.params);
  const items = rows.map(reportRow);
  const out = labs.filter((l) => !dept || l.department === dept).map((l) => ({ ...l, equipment: items.filter((i) => i.labId === l.id) }));
  res.json({ college: { name: req.college.name }, departments: [...new Set(labs.map((l) => l.department))], department: dept, labs: out });
});

collegeRouter.get("/report/equipment", async (req, res) => {
  if (!["hod", "principal", "admin"].includes(req.me.role)) return res.status(403).json({ error: "Not allowed." });
  const sc = labScope(req.me, req.college);
  if (!sc) return res.json({ groups: [], types: [], names: [] });
  const [rows] = await pool.query(reportSql(sc), sc.params);
  const all = rows.map(reportRow);
  const types = [...new Set(all.map((i) => i.type))].sort();
  const names = [...new Set(all.map((i) => i.name))].sort();
  const q = nameKey(req.query.q), type = String(req.query.type || "");
  const items = all.filter((i) => (!type || i.type === type) && (!q || nameKey(`${i.name} ${i.type} ${i.brand} ${i.purpose}`).includes(q)));
  const map = new Map();
  for (const i of items) { const k = nameKey(i.name); const g = map.get(k) || { name: i.name, type: i.type, units: 0, working: 0, workingKnown: true, cost: 0, rows: [] }; g.units += i.quantity; if (i.working === null) g.workingKnown = false; else g.working += i.working; g.cost += i.cost || 0; g.rows.push(i); map.set(k, g); }
  res.json({ college: { name: req.college.name }, types, names, groups: [...map.values()].map((g) => ({ ...g, working: g.workingKnown ? g.working : null })).sort((a, b) => a.name.localeCompare(b.name)) });
});

collegeRouter.get("/equipment/:id", async (req, res) => {
  const eq = await loadEquipment(req, req.params.id);
  if (!eq) return res.status(404).json({ error: "Equipment not found." });
  const [files] = await pool.query("SELECT id, kind, original_name AS name, size FROM equipment_files WHERE equipment_id = ? ORDER BY id", [eq.id]);
  const spec = buildSpec(eq.template_key);
  res.json({
    equipment: { id: eq.id, name: eq.name, status: eq.status, published: !!eq.pub_data, templateKey: eq.template_key, labId: eq.lab_id, labName: eq.lab_name, department: eq.lab_department, reviewNote: eq.review_note, data: eq.data, submittedAt: eq.submitted_at, verifiedAt: eq.verified_at, approvedAt: eq.approved_at },
    files, spec,
    can: { edit: canEdit(req.me, eq), review: reviewAction(req.me, eq), delete: req.me.role === "admin" || (isOwner(req.me, eq) && eq.status === "draft" && !eq.pub_data) },
  });
});

collegeRouter.patch("/equipment/:id", async (req, res) => {
  const eq = await loadEquipment(req, req.params.id);
  if (!eq) return res.status(404).json({ error: "Equipment not found." });
  if (!canEdit(req.me, eq)) return res.status(403).json({ error: "You cannot change this record." });
  const spec = buildSpec(eq.template_key);
  const clean = cleanData(spec, req.body?.data);
  if ("name" in clean && String(clean.name).length < 2) delete clean.name;
  const data = derive(eq.template_key, { ...eq.data, ...clean });
  const changed = Object.keys(clean).filter((k) => JSON.stringify(eq.data[k] ?? "") !== JSON.stringify(data[k] ?? ""));
  if (!changed.length) return res.json({ ok: true });
  // Editing something that is already with the HOD or published takes it back to "being edited"; the public keeps seeing the last approved version.
  let status = eq.status;
  if (isOwner(req.me, eq)) { if (status === "approved" || status === "submitted") status = "draft"; }
  else if (status === "approved") status = "submitted";
  await pool.query(
    "UPDATE equipment SET data = ?, name = ?, description = ?, specifications = ?, location = ?, status = ? WHERE id = ?",
    [JSON.stringify(data), data.name || eq.name, data.description || null, specText(data) || null, locationText(data) || null, status, eq.id]);
  const label = Object.fromEntries(spec.sections.flatMap((s2) => s2.fields.map((f) => [f.key, f.label])));
  await logEdit(eq.id, req.me, changed.map((k) => label[k] || k));
  res.json({ ok: true, status });
});

collegeRouter.post("/equipment/:id/submit", async (req, res) => {
  const eq = await loadEquipment(req, req.params.id);
  if (!eq) return res.status(404).json({ error: "Equipment not found." });
  if (!isOwner(req.me, eq) || !editable(eq)) return res.status(403).json({ error: "This record cannot be submitted." });
  const missing = missingRequired(buildSpec(eq.template_key), eq.data);
  if (missing.length) return res.status(400).json({ error: "Some required details are missing.", missing });
  await pool.query("UPDATE equipment SET status = 'submitted', review_note = NULL, submitted_at = NOW() WHERE id = ?", [eq.id]);
  await logHistory(eq.id, req.me, "sent to HOD", "");
  searchIndex().touch();
  res.json({ ok: true });
});

// Coordinator submits; the HOD of that department gives the final approval (publishes) or sends it back. The Principal only views.
function reviewAction(me, eq) {
  if (me.role === "admin") return eq.status === "submitted" ? "approve" : null; // the administrator can act for any HOD
  return me.role === "hod" && eq.status === "submitted" && eq.lab_department === me.department ? "approve" : null;
}
collegeRouter.post("/equipment/:id/review", async (req, res) => {
  const eq = await loadEquipment(req, req.params.id);
  if (!eq) return res.status(404).json({ error: "Equipment not found." });
  const step = reviewAction(req.me, eq);
  if (!step) return res.status(403).json({ error: "You cannot review this record right now." });
  const { decision, note } = req.body || {};
  if (decision === "reject") {
    const nt = String(note || "").trim();
    if (nt.length < 3) return res.status(400).json({ error: "Please tell the coordinator what to fix.", fields: { note: "Please explain what to fix." } });
    await pool.query("UPDATE equipment SET status = 'rejected', review_note = ? WHERE id = ?", [nt.slice(0, 2000), eq.id]);
    await logHistory(eq.id, req.me, "sent back", nt);
  } else if (decision === "approve") {
    await pool.query("UPDATE equipment SET status = 'approved', pub_data = data, approved_by = ?, approved_at = NOW(), review_note = NULL WHERE id = ?", [req.me.id, eq.id]);
    await logHistory(eq.id, req.me, "approved", "");
  } else return res.status(400).json({ error: "Unknown decision." });
  searchIndex().touch();
  res.json({ ok: true });
});

collegeRouter.delete("/equipment/:id", async (req, res) => {
  const eq = await loadEquipment(req, req.params.id);
  if (!eq) return res.status(404).json({ error: "Equipment not found." });
  if (req.me.role !== "admin" && (!isOwner(req.me, eq) || eq.status !== "draft" || eq.pub_data)) return res.status(403).json({ error: "Only your own drafts that were never published can be deleted." });
  const [files] = await pool.query("SELECT stored_name FROM equipment_files WHERE equipment_id = ?", [eq.id]);
  for (const f of files) fs.rm(path.join(STORAGE, f.stored_name), { force: true }, () => {});
  await pool.query("DELETE FROM equipment_files WHERE equipment_id = ?", [eq.id]);
  await pool.query("DELETE FROM equipment WHERE id = ?", [eq.id]);
  searchIndex().touch();
  res.json({ ok: true });
});

// ---- optional uploads (base64 in JSON: no extra packages needed) ----
collegeRouter.post("/equipment/:id/files", async (req, res) => {
  const eq = await loadEquipment(req, req.params.id);
  if (!eq) return res.status(404).json({ error: "Equipment not found." });
  if (!canEdit(req.me, eq)) return res.status(403).json({ error: "You cannot add files to this record." });
  const { kind, filename = "", contentBase64 = "" } = req.body || {};
  if (!kindOk(kind)) return res.status(400).json({ error: "Unknown document type." });
  const ext = path.extname(String(filename)).slice(1).toLowerCase();
  if (!EXT[ext]) return res.status(400).json({ error: "Please choose a PDF, a photo (JPG or PNG), a Word file or an Excel file." });
  const buf = Buffer.from(String(contentBase64), "base64");
  if (!buf.length) return res.status(400).json({ error: "That file looks empty. Please choose it again." });
  if (buf.length > MAX_FILE) return res.status(413).json({ error: "That file is bigger than 8 MB. Please choose a smaller file or reduce its size." });
  const [[{ c }]] = await pool.query("SELECT COUNT(*) AS c FROM equipment_files WHERE equipment_id = ?", [eq.id]);
  if (c >= 40) return res.status(400).json({ error: "This equipment already has many files. Please remove one first." });
  if (kind === "photos") { // one photo per equipment: a new one replaces the old
    const [old] = await pool.query("SELECT id, stored_name FROM equipment_files WHERE equipment_id = ? AND kind = 'photos'", [eq.id]);
    for (const o of old) { fs.rm(path.join(STORAGE, o.stored_name), { force: true }, () => {}); await pool.query("DELETE FROM equipment_files WHERE id = ?", [o.id]); }
  }
  fs.mkdirSync(STORAGE, { recursive: true });
  const stored = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(STORAGE, stored), buf);
  const original = path.basename(String(filename)).slice(0, 255);
  const [r] = await pool.query("INSERT INTO equipment_files (equipment_id, kind, original_name, stored_name, mime, size, uploaded_by) VALUES (?,?,?,?,?,?,?)", [eq.id, kind, original, stored, EXT[ext], buf.length, req.me.id]);
  res.status(201).json({ file: { id: r.insertId, kind, name: original, size: buf.length } });
});

async function loadFile(req) {
  const [[f]] = await pool.query("SELECT * FROM equipment_files WHERE id = ?", [Number(req.params.fileId)]);
  if (!f) return null;
  const eq = await loadEquipment(req, f.equipment_id);
  return eq ? { f, eq } : null;
}
collegeRouter.get("/files/:fileId", async (req, res) => {
  const hit = await loadFile(req);
  if (!hit) return res.status(404).json({ error: "File not found." });
  sendStored(res, hit.f);
});
collegeRouter.delete("/files/:fileId", async (req, res) => {
  const hit = await loadFile(req);
  if (!hit) return res.status(404).json({ error: "File not found." });
  if (!canEdit(req.me, hit.eq)) return res.status(403).json({ error: "You cannot remove files from this record." });
  fs.rm(path.join(STORAGE, hit.f.stored_name), { force: true }, () => {});
  await pool.query("DELETE FROM equipment_files WHERE id = ?", [hit.f.id]);
  res.json({ ok: true });
});
function sendStored(res, f) {
  const p = path.join(STORAGE, f.stored_name);
  if (!fs.existsSync(p)) return res.status(404).json({ error: "File missing on server." });
  res.setHeader("Content-Type", f.mime || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(f.original_name)}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  fs.createReadStream(p).pipe(res);
}

// ---------- public router: approved equipment only, each lab kept separate ----------
const publicRouter = express.Router();

publicRouter.get("/form-spec", (req, res) => res.json({ templates: templateList(), ...buildSpec(req.query.template) }));

publicRouter.get("/explore", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.code, c.name, c.city, COUNT(DISTINCT e.lab_id) AS labs, COUNT(e.id) AS equipment
       FROM colleges c LEFT JOIN equipment e ON e.college_id = c.id AND e.pub_data IS NOT NULL
      WHERE c.is_central = 0 GROUP BY c.id ORDER BY c.sort_order`);
  res.json({ colleges: rows.map((r) => ({ ...r, labs: n(r.labs), equipment: n(r.equipment) })) });
});

publicRouter.get("/colleges/:code", async (req, res) => {
  const [[college]] = await pool.query("SELECT id, code, name, city FROM colleges WHERE code = ? AND is_central = 0", [String(req.params.code).toUpperCase()]);
  if (!college) return res.status(404).json({ error: "College not found." });
  const [rows] = await pool.query(
    `SELECT l.id, l.department, l.name, l.description, l.building, l.floor, l.room, COUNT(e.id) AS equipment
       FROM labs l JOIN equipment e ON e.lab_id = l.id AND e.pub_data IS NOT NULL
      WHERE l.college_id = ? GROUP BY l.id ORDER BY l.department, l.name`, [college.id]);
  const departments = [];
  for (const r of rows) {
    let d = departments.find((x) => x.department === r.department);
    if (!d) departments.push((d = { department: r.department, labs: [] }));
    d.labs.push({ id: r.id, name: r.name, description: r.description, building: r.building, floor: r.floor, room: r.room, equipment: n(r.equipment) });
  }
  res.json({ college, departments });
});

// Department-wise public page: every lab of the department with its published equipment, labs kept separate.
publicRouter.get("/colleges/:code/departments/:dept", async (req, res) => {
  const [[college]] = await pool.query("SELECT id, code, name, city FROM colleges WHERE code = ? AND is_central = 0", [String(req.params.code).toUpperCase()]);
  if (!college) return res.status(404).json({ error: "College not found." });
  const department = String(req.params.dept);
  const [rows] = await pool.query(
    `SELECT e.id, e.name, e.template_key, e.pub_data AS data, l.id AS lab_id, l.name AS lab_name, l.description, l.building, l.floor, l.room
       FROM equipment e JOIN labs l ON l.id = e.lab_id WHERE e.college_id = ? AND l.department = ? AND e.pub_data IS NOT NULL ORDER BY l.name, e.name`, [college.id, department]);
  if (!rows.length) return res.status(404).json({ error: "This department has no published equipment yet." });
  const [photos] = await pool.query("SELECT equipment_id, MIN(id) AS id FROM equipment_files WHERE kind = 'photos' AND equipment_id IN (?) GROUP BY equipment_id", [rows.map((r) => r.id)]);
  const photo = Object.fromEntries(photos.map((p) => [p.equipment_id, p.id]));
  const labs = []; let working = 0;
  for (const r of rows) {
    const d = JSON.parse(r.data || "{}");
    if (d.current_status === "Working") working++;
    let lab = labs.find((x) => x.id === r.lab_id);
    if (!lab) labs.push((lab = { id: r.lab_id, name: r.lab_name, description: r.description, building: r.building, floor: r.floor, room: r.room, equipment: [] }));
    lab.equipment.push({ id: r.id, name: r.name, type: findTemplate(r.template_key)?.label, manufacturer: d.manufacturer, model: d.model, status: d.current_status, photoId: photo[r.id] || null });
  }
  res.json({ college, department, stats: { labs: labs.length, equipment: rows.length, working }, labs });
});

// The public part of one equipment record: allowed sections and fields only, and only their values (an allow-list, so a new private field can never leak).
function publicView(eq) {
  const spec = buildSpec(eq.template_key);
  const sections = spec.sections.filter((s) => PUBLIC_SECTIONS.includes(s.key)).map((s) => ({ key: s.key, title: s.title, fields: s.fields.filter((f) => !PUBLIC_HIDDEN_KEYS.has(f.key) && isVisible(f, eq.data)) }));
  const shown = new Set(["name", ...sections.flatMap((s) => s.fields.map((f) => f.key))]);
  const data = Object.fromEntries(Object.entries(eq.data).filter(([k]) => shown.has(k)));
  return { spec, sections, data };
}

// Equipment-wise public pages: one entry per equipment for the whole college (all departments and labs together).
async function publicCollege(code) {
  const [[c]] = await pool.query("SELECT id, code, name, city FROM colleges WHERE code = ? AND is_central = 0", [String(code).toUpperCase()]);
  return c || null;
}
publicRouter.get("/colleges/:code/equipment", async (req, res) => {
  const college = await publicCollege(req.params.code);
  if (!college) return res.status(404).json({ error: "We could not find that college." });
  const q = nameKey(req.query.q);
  let list = await summary.groups(college.id);
  const types = [...new Set(list.map((g) => g.type))].sort();
  if (req.query.type) list = list.filter((g) => g.type === req.query.type);
  if (q) list = list.filter((g) => nameKey(`${g.name} ${g.purpose} ${g.type} ${g.brands.map((b) => b.name).join(" ")}`).includes(q));
  res.json({ college, types, totals: { equipment: list.length, units: list.reduce((t, g) => t + g.units, 0) },
    items: list.map((g) => ({ slug: g.slug, name: g.name, type: g.type, purpose: g.purpose, units: g.units, working: g.working, labs: g.labCount, departments: g.departments, photoId: g.photoId })) });
});
publicRouter.get("/colleges/:code/equipment/:slug", async (req, res) => {
  const college = await publicCollege(req.params.code);
  if (!college) return res.status(404).json({ error: "We could not find that college." });
  const g = (await summary.groups(college.id)).find((x) => x.key === summary.unslug(req.params.slug));
  if (!g) return res.status(404).json({ error: "This equipment is not published yet." });
  res.json({ college, equipment: g, summary: await summary.summaryFor(college, g) });
});

publicRouter.get("/labs/:id", async (req, res) => {
  const [[lab]] = await pool.query(
    `SELECT l.id, l.name, l.department, l.description, l.building, l.floor, l.room, l.accessibility, c.code AS collegeCode, c.name AS collegeName,
            COALESCE(NULLIF(c.address, ''), CONCAT_WS(', ', c.name, c.city)) AS collegeAddress,
            COALESCE(NULLIF(l.contact_name, ''), u.name) AS coordinatorName, COALESCE(NULLIF(l.contact_email, ''), u.email) AS coordinatorEmail, l.contact_phone AS coordinatorPhone
       FROM labs l JOIN colleges c ON c.id = l.college_id LEFT JOIN users u ON u.id = l.incharge_user_id WHERE l.id = ?`, [Number(req.params.id)]);
  if (!lab) return res.status(404).json({ error: "Lab not found." });
  const [rows] = await pool.query("SELECT id, name, template_key, pub_data AS data FROM equipment WHERE lab_id = ? AND pub_data IS NOT NULL ORDER BY name", [lab.id]);
  if (!rows.length) return res.status(404).json({ error: "This lab has no published equipment yet." });
  const [photos] = await pool.query("SELECT equipment_id, MIN(id) AS id FROM equipment_files WHERE kind = 'photos' AND equipment_id IN (?) GROUP BY equipment_id", [rows.map((r) => r.id)]);
  const photo = Object.fromEntries(photos.map((p) => [p.equipment_id, p.id]));
  res.json({
    lab,
    equipment: rows.map((r) => { const d = JSON.parse(r.data || "{}"); return { id: r.id, name: r.name, type: findTemplate(r.template_key)?.label, manufacturer: d.manufacturer, model: d.model, description: d.description, status: d.current_status, photoId: photo[r.id] || null }; }),
  });
});

// One printable page per published lab: lab information plus the public details and photo of every published equipment.
publicRouter.get("/labs/:id/record", async (req, res) => {
  const [[lab]] = await pool.query(
    `SELECT l.id, l.name, l.department, l.description, l.building, l.floor, l.room, l.accessibility, c.code AS collegeCode, c.name AS collegeName,
            COALESCE(NULLIF(c.address, ''), CONCAT_WS(', ', c.name, c.city)) AS collegeAddress,
            COALESCE(NULLIF(l.contact_name, ''), u.name) AS coordinatorName, COALESCE(NULLIF(l.contact_email, ''), u.email) AS coordinatorEmail, l.contact_phone AS coordinatorPhone
       FROM labs l JOIN colleges c ON c.id = l.college_id LEFT JOIN users u ON u.id = l.incharge_user_id WHERE l.id = ?`, [Number(req.params.id)]);
  if (!lab) return res.status(404).json({ error: "Lab not found." });
  const [rows] = await pool.query("SELECT *, pub_data AS data FROM equipment WHERE lab_id = ? AND pub_data IS NOT NULL ORDER BY name", [lab.id]);
  if (!rows.length) return res.status(404).json({ error: "This lab has no published equipment yet." });
  const [photos] = await pool.query("SELECT equipment_id, MIN(id) AS id FROM equipment_files WHERE kind = 'photos' AND equipment_id IN (?) GROUP BY equipment_id", [rows.map((r) => r.id)]);
  const photo = Object.fromEntries(photos.map((p) => [p.equipment_id, p.id]));
  res.json({ lab, equipment: rows.map((r) => { const eq = parse(r); const v = publicView(eq); return { id: eq.id, name: eq.name, type: findTemplate(eq.template_key)?.label, sections: v.sections, data: v.data, photoId: photo[eq.id] || null }; }) });
});

publicRouter.get("/equipment/:id", async (req, res) => {
  const [[row]] = await pool.query(
    `SELECT e.*, l.name AS lab_name, l.id AS lab_id, c.code AS college_code, c.name AS college_name
       FROM equipment e JOIN labs l ON l.id = e.lab_id JOIN colleges c ON c.id = e.college_id WHERE e.id = ? AND e.pub_data IS NOT NULL`, [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: "Equipment not found." });
  const eq = parse({ ...row, data: row.pub_data });
  const { spec, sections, data } = publicView(eq);
  const [files] = await pool.query("SELECT id, kind, original_name AS name, size FROM equipment_files WHERE equipment_id = ? AND kind IN (?) ORDER BY id", [eq.id, PUBLIC_FILE_KINDS]);
  res.json({ equipment: { id: eq.id, name: eq.name, type: spec.template?.label, data, approvedAt: eq.approved_at }, lab: { id: eq.lab_id, name: eq.lab_name, department: eq.department }, college: { code: eq.college_code, name: eq.college_name }, sections, files, fileKinds: FILE_KINDS });
});

publicRouter.get("/files/:fileId", async (req, res) => {
  const [[f]] = await pool.query(
    "SELECT f.* FROM equipment_files f JOIN equipment e ON e.id = f.equipment_id WHERE f.id = ? AND e.pub_data IS NOT NULL AND f.kind IN (?)", [Number(req.params.fileId), PUBLIC_FILE_KINDS]);
  if (!f) return res.status(404).json({ error: "File not found." });
  sendStored(res, f);
});

module.exports = { collegeRouter, publicRouter, allowedKeys };

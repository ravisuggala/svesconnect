// Lab equipment module: labs (college > department > lab), the dynamic registration form, the approval chain and public lab pages.
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pool = require("../../db/pool");
const { collegeContext } = require("../../core/college");
const searchIndex = () => require("../search/index"); // lazy: keeps the index optional and avoids load-order issues
const { buildSpec, templateList, findTemplate, missingRequired, allowedKeys, isVisible, FILE_KINDS } = require("./formSpec");

const STORAGE = process.env.STORAGE_DIR || path.join(__dirname, "..", "..", "..", "storage");
const MAX_FILE = 8 * 1024 * 1024;
const EXT = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
const kindOk = (k) => FILE_KINDS.some((x) => x.key === k);

// What the public may see: no finance, warranty/AMC, internal files or known issues.
const PUBLIC_SECTIONS = ["basic", "technical", "template", "operations", "usage", "contact"];
const PUBLIC_HIDDEN_KEYS = new Set(["equipment_cost_lakhs", "known_issues"]);
const PUBLIC_FILE_KINDS = ["photos", "brochure", "user_manual"];

const parse = (row) => ({ ...row, data: row.data ? JSON.parse(row.data) : {} });
const n = (v) => Number(v) || 0;

// ---------- value cleaning ----------
function cleanValue(field, v) {
  if (v === null || v === undefined) return "";
  switch (field.type) {
    case "number": { const x = String(v).trim(); return x === "" ? "" : Number.isFinite(Number(x)) ? Number(x) : ""; }
    case "list": return (Array.isArray(v) ? v : String(v).split("\n")).map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 50);
    case "kv": return (Array.isArray(v) ? v : []).map((r) => ({ k: String(r?.k || "").trim().slice(0, 120), v: String(r?.v || "").trim().slice(0, 300) })).filter((r) => r.k || r.v).slice(0, 60);
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
            SUM(e.status = 'approved') AS approved, SUM(e.status = 'rejected') AS rejected
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
  const [rows] = await pool.query(`SELECT l.department, e.lab_id, e.status, e.template_key, e.data FROM equipment e JOIN labs l ON l.id = e.lab_id WHERE ${sc.where}`, sc.params);
  const labels = Object.fromEntries(templateList().map((t) => [t.key, t.label]));
  const blank = (department) => ({ department, labs: 0, published: 0, awaiting: 0, sentBack: 0, drafts: 0, working: 0, notWorking: 0, highValue: 0, investmentLakhs: 0 });
  const depts = new Map(), types = new Map();
  for (const l of labs) { const d = depts.get(l.department) || blank(l.department); d.labs++; depts.set(l.department, d); }
  for (const r of rows) {
    const d = depts.get(r.department) || blank(r.department); depts.set(r.department, d);
    if (r.status === "draft") d.drafts++; else if (r.status === "submitted") d.awaiting++; else if (r.status === "rejected") d.sentBack++;
    if (r.status !== "approved") continue;
    d.published++;
    const data = r.data ? JSON.parse(r.data) : {};
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
  const [rows] = await pool.query("SELECT id, name, template_key AS templateKey, status, review_note AS reviewNote, updated_at AS updatedAt FROM equipment WHERE lab_id = ? ORDER BY updated_at DESC", [lab.id]);
  res.json({ lab, equipment: rows, templates: templateList() });
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

collegeRouter.post("/labs/:id/equipment", async (req, res) => {
  const lab = await loadLab(req, req.params.id);
  if (!lab || !(req.me.role === "lab_incharge" && req.me.lab_id === lab.id)) return res.status(403).json({ error: "Only the lab coordinator can add equipment." });
  const { templateKey, name } = req.body || {};
  const tpl = findTemplate(templateKey);
  if (!tpl) return res.status(400).json({ error: "Choose an equipment type.", fields: { templateKey: "Choose an equipment type." } });
  const nm = String(name || "").trim().slice(0, 255);
  if (nm.length < 2) return res.status(400).json({ error: "Enter the equipment name.", fields: { name: "Enter the equipment name." } });
  // Prefill what we already know so the coordinator is not asked twice.
  const data = { name: nm, contact_name: req.me.name, contact_email: req.me.email, contact_department: lab.department, building: lab.building || "", floor: lab.floor || "", room: lab.room || "", accessibility: lab.accessibility || "" };
  const [r] = await pool.query(
    "INSERT INTO equipment (college_id, lab_id, department, template_key, name, category, data, status, created_by) VALUES (?,?,?,?,?,?,?, 'draft', ?)",
    [req.college.id, lab.id, lab.department, tpl.key, nm, tpl.label, JSON.stringify(data), req.me.id]);
  res.status(201).json({ id: r.insertId });
});

collegeRouter.get("/equipment/:id", async (req, res) => {
  const eq = await loadEquipment(req, req.params.id);
  if (!eq) return res.status(404).json({ error: "Equipment not found." });
  const [files] = await pool.query("SELECT id, kind, original_name AS name, size FROM equipment_files WHERE equipment_id = ? ORDER BY id", [eq.id]);
  const spec = buildSpec(eq.template_key);
  res.json({
    equipment: { id: eq.id, name: eq.name, status: eq.status, templateKey: eq.template_key, labId: eq.lab_id, labName: eq.lab_name, department: eq.lab_department, reviewNote: eq.review_note, data: eq.data, submittedAt: eq.submitted_at, verifiedAt: eq.verified_at, approvedAt: eq.approved_at },
    files, spec,
    can: { edit: isOwner(req.me, eq) && editable(eq), review: reviewAction(req.me, eq), delete: req.me.role === "admin" || (isOwner(req.me, eq) && eq.status === "draft") },
  });
});

collegeRouter.patch("/equipment/:id", async (req, res) => {
  const eq = await loadEquipment(req, req.params.id);
  if (!eq) return res.status(404).json({ error: "Equipment not found." });
  if (!isOwner(req.me, eq) || !editable(eq)) return res.status(403).json({ error: "This record can no longer be edited." });
  const spec = buildSpec(eq.template_key);
  const clean = cleanData(spec, req.body?.data);
  if ("name" in clean && String(clean.name).length < 2) delete clean.name;
  const data = { ...eq.data, ...clean };
  await pool.query(
    "UPDATE equipment SET data = ?, name = ?, description = ?, specifications = ?, location = ? WHERE id = ?",
    [JSON.stringify(data), data.name || eq.name, data.description || null, specText(data) || null, locationText(data) || null, eq.id]);
  res.json({ ok: true });
});

collegeRouter.post("/equipment/:id/submit", async (req, res) => {
  const eq = await loadEquipment(req, req.params.id);
  if (!eq) return res.status(404).json({ error: "Equipment not found." });
  if (!isOwner(req.me, eq) || !editable(eq)) return res.status(403).json({ error: "This record cannot be submitted." });
  const missing = missingRequired(buildSpec(eq.template_key), eq.data);
  if (missing.length) return res.status(400).json({ error: "Some required details are missing.", missing });
  await pool.query("UPDATE equipment SET status = 'submitted', review_note = NULL, submitted_at = NOW() WHERE id = ?", [eq.id]);
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
  } else if (decision === "approve") {
    await pool.query("UPDATE equipment SET status = 'approved', approved_by = ?, approved_at = NOW(), review_note = NULL WHERE id = ?", [req.me.id, eq.id]);
  } else return res.status(400).json({ error: "Unknown decision." });
  searchIndex().touch();
  res.json({ ok: true });
});

collegeRouter.delete("/equipment/:id", async (req, res) => {
  const eq = await loadEquipment(req, req.params.id);
  if (!eq) return res.status(404).json({ error: "Equipment not found." });
  if (req.me.role !== "admin" && (!isOwner(req.me, eq) || eq.status !== "draft")) return res.status(403).json({ error: "Only your own drafts can be deleted." });
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
  if (!isOwner(req.me, eq) || !editable(eq)) return res.status(403).json({ error: "Files can only be added while the record is a draft." });
  const { kind, filename = "", contentBase64 = "" } = req.body || {};
  if (!kindOk(kind)) return res.status(400).json({ error: "Unknown document type." });
  const ext = path.extname(String(filename)).slice(1).toLowerCase();
  if (!EXT[ext]) return res.status(400).json({ error: "Allowed files: PDF, images, Word and Excel." });
  const buf = Buffer.from(String(contentBase64), "base64");
  if (!buf.length) return res.status(400).json({ error: "The file is empty." });
  if (buf.length > MAX_FILE) return res.status(413).json({ error: "File is larger than 8 MB." });
  const [[{ c }]] = await pool.query("SELECT COUNT(*) AS c FROM equipment_files WHERE equipment_id = ?", [eq.id]);
  if (c >= 40) return res.status(400).json({ error: "Too many files for one equipment." });
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
  if (!isOwner(req.me, hit.eq) || !editable(hit.eq)) return res.status(403).json({ error: "Files can only be removed while the record is a draft." });
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
       FROM colleges c LEFT JOIN equipment e ON e.college_id = c.id AND e.status = 'approved'
      WHERE c.is_central = 0 GROUP BY c.id ORDER BY c.sort_order`);
  res.json({ colleges: rows.map((r) => ({ ...r, labs: n(r.labs), equipment: n(r.equipment) })) });
});

publicRouter.get("/colleges/:code", async (req, res) => {
  const [[college]] = await pool.query("SELECT id, code, name, city FROM colleges WHERE code = ? AND is_central = 0", [String(req.params.code).toUpperCase()]);
  if (!college) return res.status(404).json({ error: "College not found." });
  const [rows] = await pool.query(
    `SELECT l.id, l.department, l.name, l.description, l.building, l.floor, l.room, COUNT(e.id) AS equipment
       FROM labs l JOIN equipment e ON e.lab_id = l.id AND e.status = 'approved'
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
    `SELECT e.id, e.name, e.template_key, e.data, l.id AS lab_id, l.name AS lab_name, l.description, l.building, l.floor, l.room
       FROM equipment e JOIN labs l ON l.id = e.lab_id WHERE e.college_id = ? AND l.department = ? AND e.status = 'approved' ORDER BY l.name, e.name`, [college.id, department]);
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

publicRouter.get("/labs/:id", async (req, res) => {
  const [[lab]] = await pool.query(
    `SELECT l.id, l.name, l.department, l.description, l.building, l.floor, l.room, l.accessibility, c.code AS collegeCode, c.name AS collegeName,
            COALESCE(NULLIF(c.address, ''), CONCAT_WS(', ', c.name, c.city)) AS collegeAddress,
            COALESCE(NULLIF(l.contact_name, ''), u.name) AS coordinatorName, COALESCE(NULLIF(l.contact_email, ''), u.email) AS coordinatorEmail, l.contact_phone AS coordinatorPhone
       FROM labs l JOIN colleges c ON c.id = l.college_id LEFT JOIN users u ON u.id = l.incharge_user_id WHERE l.id = ?`, [Number(req.params.id)]);
  if (!lab) return res.status(404).json({ error: "Lab not found." });
  const [rows] = await pool.query("SELECT id, name, template_key, data FROM equipment WHERE lab_id = ? AND status = 'approved' ORDER BY name", [lab.id]);
  if (!rows.length) return res.status(404).json({ error: "This lab has no published equipment yet." });
  const [photos] = await pool.query("SELECT equipment_id, MIN(id) AS id FROM equipment_files WHERE kind = 'photos' AND equipment_id IN (?) GROUP BY equipment_id", [rows.map((r) => r.id)]);
  const photo = Object.fromEntries(photos.map((p) => [p.equipment_id, p.id]));
  res.json({
    lab,
    equipment: rows.map((r) => { const d = JSON.parse(r.data || "{}"); return { id: r.id, name: r.name, type: findTemplate(r.template_key)?.label, manufacturer: d.manufacturer, model: d.model, description: d.description, status: d.current_status, photoId: photo[r.id] || null }; }),
  });
});

publicRouter.get("/equipment/:id", async (req, res) => {
  const [[row]] = await pool.query(
    `SELECT e.*, l.name AS lab_name, l.id AS lab_id, c.code AS college_code, c.name AS college_name
       FROM equipment e JOIN labs l ON l.id = e.lab_id JOIN colleges c ON c.id = e.college_id WHERE e.id = ? AND e.status = 'approved'`, [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: "Equipment not found." });
  const eq = parse(row);
  const spec = buildSpec(eq.template_key);
  const sections = spec.sections.filter((s) => PUBLIC_SECTIONS.includes(s.key)).map((s) => ({ ...s, fields: s.fields.filter((f) => !PUBLIC_HIDDEN_KEYS.has(f.key) && isVisible(f, eq.data)) }));
  // Send only the values of fields that are shown publicly (an allow-list, so new private fields can never leak).
  const shown = new Set(["name", ...sections.flatMap((s) => s.fields.map((f) => f.key))]);
  const data = Object.fromEntries(Object.entries(eq.data).filter(([k]) => shown.has(k)));
  const [files] = await pool.query("SELECT id, kind, original_name AS name, size FROM equipment_files WHERE equipment_id = ? AND kind IN (?) ORDER BY id", [eq.id, PUBLIC_FILE_KINDS]);
  res.json({ equipment: { id: eq.id, name: eq.name, type: spec.template?.label, data, approvedAt: eq.approved_at }, lab: { id: eq.lab_id, name: eq.lab_name, department: eq.department }, college: { code: eq.college_code, name: eq.college_name }, sections, files, fileKinds: FILE_KINDS });
});

publicRouter.get("/files/:fileId", async (req, res) => {
  const [[f]] = await pool.query(
    "SELECT f.* FROM equipment_files f JOIN equipment e ON e.id = f.equipment_id WHERE f.id = ? AND e.status = 'approved' AND f.kind IN (?)", [Number(req.params.fileId), PUBLIC_FILE_KINDS]);
  if (!f) return res.status(404).json({ error: "File not found." });
  sendStored(res, f);
});

module.exports = { collegeRouter, publicRouter, allowedKeys };

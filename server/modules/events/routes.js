// Events module: any kind of event/project (BAJA, workshops, fests, consultancy ...) organised college > year > event > folder > file.
// People: HOD/Principal create an event and its coordinator login; the coordinator uploads files with metadata and adds team members;
// everyone involved can view/download every file; the HOD publishes; the public sees a summary and the files marked public.
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pool = require("../../db/pool");
const { collegeContext } = require("../../core/college");
const { hashPassword } = require("../../core/security");
const { defaultPassword } = require("../../core/org");
const { findType, typeList } = require("./typeSpec");
const { extractText, summarize, clean } = require("./extract");

const STORAGE = process.env.STORAGE_DIR || path.join(__dirname, "..", "..", "..", "storage");
const MAX_FILE = 8 * 1024 * 1024;
const MIME = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", mp4: "video/mp4",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", md: "text/plain", csv: "text/csv", zip: "application/zip",
  sldprt: "application/octet-stream", sldasm: "application/octet-stream", slddrw: "application/octet-stream", sldalasm: "application/octet-stream", igs: "application/octet-stream", iges: "application/octet-stream", x_t: "application/octet-stream", catpart: "application/octet-stream", catproduct: "application/octet-stream", obj: "application/octet-stream",
  dwg: "application/octet-stream", dxf: "application/octet-stream", step: "application/octet-stream", stp: "application/octet-stream", stl: "application/octet-stream",
};
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const t = (v, m) => String(v ?? "").trim().slice(0, m);
const slug = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "x";
const n = (v) => Number(v) || 0;

// ---------- access ----------
const isEventRole = (me) => me.role === "event_coordinator" || me.role === "event_member";
function scopeSql(me, college) {
  if (me.role === "admin" || me.role === "principal") return { where: "e.college_id = ?", params: [college.id] };
  if (me.role === "hod") return me.department ? { where: "e.college_id = ? AND e.department = ?", params: [college.id, me.department] } : null;
  if (isEventRole(me)) return me.event_id ? { where: "e.college_id = ? AND e.id = ?", params: [college.id, me.event_id] } : null;
  return null;
}
async function loadEvent(req, id) {
  const sc = scopeSql(req.me, req.college);
  if (!sc) return null;
  const [[ev]] = await pool.query(`SELECT e.* FROM events e WHERE ${sc.where} AND e.id = ?`, [...sc.params, Number(id)]);
  return ev || null;
}
// Who may change an event's content: its coordinator, or the HOD/Principal/admin above it.
const canManage = (me, ev) => (me.role === "event_coordinator" && me.event_id === ev.id) || ["hod", "principal", "admin"].includes(me.role);
const canPublish = (me) => ["hod", "principal", "admin"].includes(me.role);
const needEvent = (fn) => async (req, res) => {
  const ev = await loadEvent(req, req.params.id);
  if (!ev) return res.status(404).json({ error: "Event not found." });
  return fn(req, res, ev);
};
const touchSearch = () => { try { require("../search/index").touch(); } catch { /* search optional */ } };

// ---------- disk layout: STORAGE/events/<COLLEGE>/<year>/<id>-<event>/<folder>[/<subfolder>]/<file> ----------
const eventDir = (college, ev) => path.join("events", college.code, slug(ev.academic_year || "undated"), `${ev.id}-${slug(ev.name)}`);
const fileDir = (college, ev, folder, sub) => path.join(eventDir(college, ev), slug(folder), ...(sub ? [slug(sub)] : []));
function sendStored(res, f, download) {
  const p = path.join(STORAGE, f.stored_name);
  if (!p.startsWith(STORAGE) || !fs.existsSync(p)) return res.status(404).json({ error: "File missing on server." });
  res.setHeader("Content-Type", f.mime || "application/octet-stream");
  res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(f.original_name)}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  fs.createReadStream(p).pipe(res);
}

const fileRow = (f) => ({ id: f.id, folder: f.folder, subfolder: f.subfolder || "", title: f.title, description: f.description || "", contributor: f.contributor || "", fileDate: f.file_date || "", tags: f.tags ? f.tags.split(",").filter(Boolean) : [], isPublic: !!f.is_public, name: f.original_name, mime: f.mime, size: f.size, summary: f.summary || "", createdAt: f.created_at });
const FILE_COLS = "id, event_id, folder, subfolder, title, description, contributor, file_date, tags, is_public, original_name, mime, size, summary, created_at";
const isImage = (f) => (f.mime || "").startsWith("image/");

/** What the public learns about an event: its own description plus what was extracted from the public files. */
function buildSummary(ev, college, typeLabel, files) {
  const photos = files.filter(isImage);
  const folders = {};
  for (const f of files) (folders[f.folder] = folders[f.folder] || []).push(f);
  const credits = [...new Set(files.map((f) => f.contributor).filter(Boolean))];
  const seen = new Set();
  const highlights = files.filter((f) => f.summary && !seen.has(f.summary) && seen.add(f.summary)).slice(0, 8).map((f) => ({ text: f.summary, source: f.title, folder: f.folder, fileId: f.id }));
  const overview = clean(ev.description) || [
    `${ev.name} is a ${typeLabel.toLowerCase()} of ${college.name}`, ev.event_date && `held in ${ev.event_date}`, ev.academic_year && `(academic year ${ev.academic_year})`,
  ].filter(Boolean).join(" ") + `. Its record has ${files.length} published ${files.length === 1 ? "file" : "files"} in ${Object.keys(folders).length} ${Object.keys(folders).length === 1 ? "folder" : "folders"}.`;
  return {
    overview, highlights, credits,
    stats: { files: files.length, photos: photos.length, folders: Object.keys(folders).length, contributors: credits.length },
    folders: Object.entries(folders).map(([name, list]) => ({ name, count: list.length, titles: list.slice(0, 4).map((f) => f.title) })),
  };
}

// ---------- college-scoped router ----------
const collegeRouter = express.Router({ mergeParams: true });
collegeRouter.use(collegeContext);

collegeRouter.get("/events", async (req, res) => {
  const sc = scopeSql(req.me, req.college);
  if (!sc) return res.json({ events: [] });
  const [rows] = await pool.query(
    `SELECT e.id, e.name, e.type_key, e.department, e.academic_year, e.event_date, e.venue, e.status, e.created_at,
            (SELECT COUNT(*) FROM event_files f WHERE f.event_id = e.id) AS files,
            (SELECT COUNT(*) FROM event_files f WHERE f.event_id = e.id AND f.is_public = 1) AS publicFiles,
            (SELECT u.email FROM users u WHERE u.event_id = e.id AND u.role = 'event_coordinator' LIMIT 1) AS coordinator
       FROM events e WHERE ${sc.where} ORDER BY e.academic_year DESC, e.created_at DESC`, sc.params);
  res.json({ events: rows.map((r) => ({ ...r, type: findType(r.type_key)?.label || r.type_key, files: n(r.files), publicFiles: n(r.publicFiles) })) });
});

async function createLogin(req, ev, role, email, name, department) {
  const [dup] = await pool.query("SELECT id FROM users WHERE college_id = ? AND email = ?", [req.college.id, email]);
  if (dup.length) return { error: "That email already has an account in this college." };
  const [ins] = await pool.query(
    "INSERT INTO users (college_id, name, email, password_hash, role, department, event_id, created_by, must_change_password) VALUES (?,?,?,?,?,?,?,?,1)",
    [req.college.id, name || (role === "event_coordinator" ? `${ev.name} Coordinator` : email.split("@")[0]), email, hashPassword(defaultPassword()), role, department || null, ev.id, req.me.id]);
  return { id: ins.insertId, email };
}

collegeRouter.post("/events", async (req, res) => {
  const { me, college } = req;
  if (!["principal", "hod", "admin"].includes(me.role)) return res.status(403).json({ error: "Only the HOD or Principal can create an event." });
  const b = req.body || {};
  const fields = {};
  const name = t(b.name, 200);
  if (name.length < 3) fields.name = "Enter the event name.";
  if (!findType(b.typeKey)) fields.typeKey = "Choose the type of event.";
  const department = me.role === "hod" ? me.department : t(b.department, 120) || null;
  const coEmail = t(b.coordinatorEmail, 190).toLowerCase();
  if (coEmail && !emailOk(coEmail)) fields.coordinatorEmail = "Enter a valid email address.";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please correct the highlighted fields.", fields });
  if (coEmail) {
    const [dup] = await pool.query("SELECT id FROM users WHERE college_id = ? AND email = ?", [college.id, coEmail]);
    if (dup.length) return res.status(409).json({ error: "That email already has an account in this college.", fields: { coordinatorEmail: "That email already has an account in this college." } });
  }
  const [r] = await pool.query("INSERT INTO events (college_id, department, type_key, name, academic_year, event_date, venue, description, created_by) VALUES (?,?,?,?,?,?,?,?,?)",
    [college.id, department, b.typeKey, name, t(b.academicYear, 20) || null, t(b.eventDate, 60) || null, t(b.venue, 200) || null, t(b.description, 4000) || null, me.id]);
  const ev = { id: r.insertId, name };
  let login = null;
  if (coEmail) {
    login = await createLogin(req, ev, "event_coordinator", coEmail, t(b.coordinatorName, 120), department);
    fs.mkdirSync(path.join(STORAGE, eventDir(college, { ...ev, academic_year: t(b.academicYear, 20) })), { recursive: true });
  }
  touchSearch();
  res.status(201).json({ id: ev.id, coordinator: login && !login.error ? { email: coEmail, password: defaultPassword() } : null });
});

collegeRouter.get("/events/:id", needEvent(async (req, res, ev) => {
  const type = findType(ev.type_key);
  const [files] = await pool.query(`SELECT ${FILE_COLS} FROM event_files WHERE event_id = ? ORDER BY folder, subfolder, created_at DESC`, [ev.id]);
  const [people] = await pool.query("SELECT id, name, email, role, status FROM users WHERE event_id = ? ORDER BY role, email", [ev.id]);
  const publicFiles = files.filter((f) => f.is_public);
  res.json({
    event: { id: ev.id, name: ev.name, typeKey: ev.type_key, type: type?.label, department: ev.department, academicYear: ev.academic_year, eventDate: ev.event_date, venue: ev.venue, description: ev.description || "", status: ev.status, publishedAt: ev.published_at },
    defaultFolders: type?.folders || [], files: files.map(fileRow), people,
    can: { manage: canManage(req.me, ev), publish: canPublish(req.me), addPeople: canManage(req.me, ev) },
    publicPreview: buildSummary(ev, req.college, type?.label || "event", publicFiles),
  });
}));

collegeRouter.patch("/events/:id", needEvent(async (req, res, ev) => {
  if (!canManage(req.me, ev)) return res.status(403).json({ error: "You cannot edit this event." });
  const b = req.body || {};
  await pool.query("UPDATE events SET name = ?, academic_year = ?, event_date = ?, venue = ?, description = ? WHERE id = ?",
    [t(b.name, 200) || ev.name, t(b.academicYear, 20) || null, t(b.eventDate, 60) || null, t(b.venue, 200) || null, t(b.description, 4000) || null, ev.id]);
  touchSearch();
  res.json({ ok: true });
}));

collegeRouter.post("/events/:id/publish", needEvent(async (req, res, ev) => {
  if (!canPublish(req.me)) return res.status(403).json({ error: "Only the HOD or Principal can publish an event." });
  const on = !!(req.body || {}).published;
  await pool.query("UPDATE events SET status = ?, published_at = ? WHERE id = ?", [on ? "published" : "draft", on ? new Date() : null, ev.id]);
  touchSearch();
  res.json({ ok: true, status: on ? "published" : "draft" });
}));

// ---- people: coordinator (and HOD/Principal) add team members who can view and download every file ----
collegeRouter.post("/events/:id/people", needEvent(async (req, res, ev) => {
  if (!canManage(req.me, ev)) return res.status(403).json({ error: "You cannot add people to this event." });
  const b = req.body || {};
  const email = t(b.email, 190).toLowerCase();
  if (!emailOk(email)) return res.status(400).json({ error: "Enter a valid email address.", fields: { email: "Enter a valid email address." } });
  const role = b.role === "event_coordinator" && req.me.role !== "event_coordinator" ? "event_coordinator" : "event_member";
  const r = await createLogin(req, ev, role, email, t(b.name, 120), ev.department);
  if (r.error) return res.status(409).json({ error: r.error, fields: { email: r.error } });
  res.status(201).json({ email, initialPassword: defaultPassword() });
}));
collegeRouter.patch("/events/:id/people/:uid", needEvent(async (req, res, ev) => {
  if (!canManage(req.me, ev)) return res.status(403).json({ error: "You cannot change this account." });
  const [[u]] = await pool.query("SELECT id, role FROM users WHERE id = ? AND event_id = ?", [Number(req.params.uid), ev.id]);
  if (!u || u.id === req.me.id) return res.status(404).json({ error: "Account not found." });
  if (u.role === "event_coordinator" && req.me.role === "event_coordinator") return res.status(403).json({ error: "Only the HOD can change the coordinator." });
  const { action } = req.body || {};
  if (action === "reset") { await pool.query("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?", [hashPassword(defaultPassword()), u.id]); return res.json({ ok: true, initialPassword: defaultPassword() }); }
  if (action === "disable" || action === "enable") { await pool.query("UPDATE users SET status = ? WHERE id = ?", [action === "disable" ? "disabled" : "active", u.id]); return res.json({ ok: true }); }
  res.status(400).json({ error: "Unknown action." });
}));

// ---- files (uploaded as base64 JSON: no extra packages) ----
function cleanMeta(b, type) {
  const folder = t(b.folder, 80) || type?.folders?.[0]?.name || "Others";
  const def = type?.folders.find((f) => f.name.toLowerCase() === folder.toLowerCase());
  return {
    folder: def ? def.name : folder, subfolder: t(b.subfolder, 80) || null, title: t(b.title, 200), description: t(b.description, 3000) || null,
    contributor: t(b.contributor, 160) || null, fileDate: t(b.fileDate, 40) || null,
    tags: (Array.isArray(b.tags) ? b.tags : String(b.tags || "").split(",")).map((x) => t(x, 30)).filter(Boolean).slice(0, 12).join(",") || null,
    isPublic: b.isPublic === undefined ? def?.public !== false : !!b.isPublic,
  };
}

/** Writes one file into its folder on disk and records it with its metadata and machine summary. Shared by uploads and the BAJA importer. */
async function saveEventFile(college, ev, { filename, buf, meta: m, uploadedBy }) {
  const original = path.basename(String(filename)).slice(0, 200);
  const ext = path.extname(original).slice(1).toLowerCase();
  const title = m.title || original.replace(/\.[^.]+$/, "");
  const dir = fileDir(college, ev, m.folder, m.subfolder);
  fs.mkdirSync(path.join(STORAGE, dir), { recursive: true });
  const stored = path.join(dir, `${crypto.randomBytes(6).toString("hex")}-${slug(path.basename(original, `.${ext}`))}.${ext}`);
  fs.writeFileSync(path.join(STORAGE, stored), buf);
  const body = extractText(buf, ext);
  const text = clean(`${m.description || ""} ${body}`).slice(0, 20000);
  const summary = summarize(body, 2) || summarize(m.description, 2) || clean(m.description).slice(0, 300) || null;
  const [r] = await pool.query(
    "INSERT INTO event_files (event_id, folder, subfolder, title, description, contributor, file_date, tags, is_public, original_name, stored_name, mime, size, summary, extracted, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [ev.id, m.folder, m.subfolder, title, m.description, m.contributor, m.fileDate, m.tags, m.isPublic ? 1 : 0, original, stored, MIME[ext], buf.length, summary, text, uploadedBy]);
  return r.insertId;
}
collegeRouter.post("/events/:id/files", needEvent(async (req, res, ev) => {
  if (!canManage(req.me, ev)) return res.status(403).json({ error: "Only the event coordinator can upload files." });
  const b = req.body || {};
  const ext = path.extname(String(b.filename || "")).slice(1).toLowerCase();
  if (!MIME[ext]) return res.status(400).json({ error: "This file type is not allowed (PDF, images, Office files, CSV/text, ZIP, CAD and MP4 are)." });
  const buf = Buffer.from(String(b.contentBase64 || ""), "base64");
  if (!buf.length) return res.status(400).json({ error: "The file is empty." });
  if (buf.length > MAX_FILE) return res.status(413).json({ error: "File is larger than 8 MB." });
  const [[{ c }]] = await pool.query("SELECT COUNT(*) AS c FROM event_files WHERE event_id = ?", [ev.id]);
  if (c >= 500) return res.status(400).json({ error: "This event has reached the 500 file limit." });
  const id = await saveEventFile(req.college, ev, { filename: b.filename, buf, meta: cleanMeta(b, findType(ev.type_key)), uploadedBy: req.me.id });
  touchSearch();
  const [[row]] = await pool.query(`SELECT ${FILE_COLS} FROM event_files WHERE id = ?`, [id]);
  res.status(201).json({ file: fileRow(row) });
}));

async function loadFile(req) {
  const [[f]] = await pool.query("SELECT * FROM event_files WHERE id = ?", [Number(req.params.fileId)]);
  if (!f) return null;
  const ev = await loadEvent(req, f.event_id);
  return ev ? { f, ev } : null;
}
collegeRouter.get("/event-files/:fileId", async (req, res) => {
  const hit = await loadFile(req);
  if (!hit) return res.status(404).json({ error: "File not found." });
  sendStored(res, hit.f, req.query.download === "1");
});
collegeRouter.patch("/event-files/:fileId", async (req, res) => {
  const hit = await loadFile(req);
  if (!hit) return res.status(404).json({ error: "File not found." });
  if (!canManage(req.me, hit.ev)) return res.status(403).json({ error: "You cannot edit this file." });
  const m = cleanMeta({ ...req.body, isPublic: (req.body || {}).isPublic ?? !!hit.f.is_public }, findType(hit.ev.type_key));
  let stored = hit.f.stored_name;
  if (m.folder !== hit.f.folder || (m.subfolder || null) !== (hit.f.subfolder || null)) {
    const dir = fileDir(req.college, hit.ev, m.folder, m.subfolder);
    fs.mkdirSync(path.join(STORAGE, dir), { recursive: true });
    const next = path.join(dir, path.basename(hit.f.stored_name));
    try { fs.renameSync(path.join(STORAGE, hit.f.stored_name), path.join(STORAGE, next)); stored = next; } catch { return res.status(500).json({ error: "Could not move the file." }); }
  }
  await pool.query("UPDATE event_files SET folder = ?, subfolder = ?, title = ?, description = ?, contributor = ?, file_date = ?, tags = ?, is_public = ?, stored_name = ? WHERE id = ?",
    [m.folder, m.subfolder, m.title || hit.f.title, m.description, m.contributor, m.fileDate, m.tags, m.isPublic ? 1 : 0, stored, hit.f.id]);
  touchSearch();
  res.json({ ok: true });
});
collegeRouter.delete("/event-files/:fileId", async (req, res) => {
  const hit = await loadFile(req);
  if (!hit) return res.status(404).json({ error: "File not found." });
  if (!canManage(req.me, hit.ev)) return res.status(403).json({ error: "You cannot delete this file." });
  fs.rm(path.join(STORAGE, hit.f.stored_name), { force: true }, () => {});
  await pool.query("DELETE FROM event_files WHERE id = ?", [hit.f.id]);
  touchSearch();
  res.json({ ok: true });
});

// ---------- public router: published events only, public files only ----------
const publicRouter = express.Router();
publicRouter.get("/event-types", (req, res) => res.json({ types: typeList() }));

publicRouter.get("/events", async (req, res) => {
  const [colleges] = await pool.query("SELECT id, code, name, city, address FROM colleges WHERE is_central = 0 ORDER BY sort_order");
  const [rows] = await pool.query(
    `SELECT e.id, e.college_id, e.name, e.type_key, e.academic_year, e.event_date, e.venue, e.description, e.published_at,
            (SELECT COUNT(*) FROM event_files f WHERE f.event_id = e.id AND f.is_public = 1) AS files,
            (SELECT MIN(f.id) FROM event_files f WHERE f.event_id = e.id AND f.is_public = 1 AND f.mime LIKE 'image/%') AS cover,
            (SELECT f.summary FROM event_files f WHERE f.event_id = e.id AND f.is_public = 1 AND f.summary IS NOT NULL ORDER BY LENGTH(f.summary) DESC LIMIT 1) AS gist
       FROM events e WHERE e.status = 'published' ORDER BY e.academic_year DESC, e.published_at DESC`);
  res.json({
    colleges: colleges.map((c) => ({
      code: c.code, name: c.name, city: c.city, address: c.address,
      events: rows.filter((r) => r.college_id === c.id).map((r) => ({ id: r.id, name: r.name, type: findType(r.type_key)?.label || r.type_key, academicYear: r.academic_year, eventDate: r.event_date, venue: r.venue, files: n(r.files), cover: r.cover, short: clean(r.description || r.gist).slice(0, 220) })),
    })),
  });
});

publicRouter.get("/events/:id", async (req, res) => {
  const [[ev]] = await pool.query("SELECT e.*, c.code, c.name AS college_name, c.city, c.address FROM events e JOIN colleges c ON c.id = e.college_id WHERE e.id = ? AND e.status = 'published'", [Number(req.params.id)]);
  if (!ev) return res.status(404).json({ error: "Event not found." });
  const type = findType(ev.type_key);
  const [files] = await pool.query(`SELECT ${FILE_COLS} FROM event_files WHERE event_id = ? AND is_public = 1 ORDER BY folder, subfolder, created_at DESC`, [ev.id]);
  const college = { code: ev.code, name: ev.college_name, city: ev.city, address: ev.address };
  res.json({
    event: { id: ev.id, name: ev.name, type: type?.label, academicYear: ev.academic_year, eventDate: ev.event_date, venue: ev.venue, department: ev.department },
    college, summary: buildSummary(ev, college, type?.label || "event", files),
    // The public never receives who uploaded, tags or other internal metadata beyond the credit line.
    files: files.map((f) => ({ id: f.id, folder: f.folder, subfolder: f.subfolder || "", title: f.title, description: f.description || "", contributor: f.contributor || "", fileDate: f.file_date || "", name: f.original_name, mime: f.mime, size: f.size })),
  });
});

publicRouter.get("/event-files/:fileId", async (req, res) => {
  const [[f]] = await pool.query("SELECT f.* FROM event_files f JOIN events e ON e.id = f.event_id WHERE f.id = ? AND f.is_public = 1 AND e.status = 'published'", [Number(req.params.fileId)]);
  if (!f) return res.status(404).json({ error: "File not found." });
  sendStored(res, f, req.query.download === "1");
});

module.exports = { collegeRouter, publicRouter, saveEventFile, cleanMeta, MIME, STORAGE, fileDir, slug };

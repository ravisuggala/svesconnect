// Administrator console API (mounted at /api/admin): every college, every user, every lab and event in one place.
const express = require("express");
const pool = require("../../db/pool");
const { hashPassword } = require("../../core/security");
const { requireAuth, requireRole } = require("../../core/middleware");
const { defaultPassword } = require("../../core/org");

const router = express.Router();
router.use(requireAuth, requireRole("admin", "college_admin"));
// The central administrator sees every college; a college administrator sees and changes only their own college.
router.use((req, res, next) => { req.scopeCollege = req.user.role === "college_admin" ? Number(req.user.college_id) : null; next(); });

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const t = (v, m) => String(v ?? "").trim().slice(0, m);
const n = (v) => Number(v) || 0;
const ROLES = ["admin", "college_admin", "principal", "hod", "lab_incharge", "event_coordinator", "event_member"];
const USER_SQL = `SELECT u.id, u.name, u.email, u.role, u.department, u.status, u.must_change_password AS mustChangePassword, u.created_at AS createdAt,
    c.code AS college, c.name AS collegeName, l.name AS labName, u.lab_id AS labId, u.event_id AS eventId, e.name AS eventName
  FROM users u LEFT JOIN colleges c ON c.id = u.college_id LEFT JOIN labs l ON l.id = u.lab_id LEFT JOIN events e ON e.id = u.event_id`;

// ---- overview: one row per college ----
router.get("/summary", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.id, c.code, c.name, c.city,
       (SELECT COUNT(*) FROM users u WHERE u.college_id = c.id) AS users,
       (SELECT COUNT(*) FROM users u WHERE u.college_id = c.id AND u.status = 'disabled') AS disabled,
       (SELECT COUNT(*) FROM labs l WHERE l.college_id = c.id) AS labs,
       (SELECT COUNT(*) FROM equipment q WHERE q.college_id = c.id) AS equipment,
       (SELECT COUNT(*) FROM equipment q WHERE q.college_id = c.id AND q.status = 'submitted') AS awaiting,
       (SELECT COUNT(*) FROM equipment q WHERE q.college_id = c.id AND q.pub_data IS NOT NULL) AS approved,
       (SELECT COUNT(*) FROM events e WHERE e.college_id = c.id) AS events,
       (SELECT COUNT(*) FROM events e WHERE e.college_id = c.id AND e.status = 'published') AS publishedEvents,
       (SELECT COUNT(*) FROM event_files f JOIN events e ON e.id = f.event_id WHERE e.college_id = c.id) AS files
     FROM colleges c WHERE c.is_central = 0 AND (? IS NULL OR c.id = ?) ORDER BY c.sort_order`, [req.scopeCollege, req.scopeCollege]);
  const colleges = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, ["code", "name", "city", "id"].includes(k) ? v : n(v)])));
  const total = (k) => colleges.reduce((a, c) => a + c[k], 0);
  res.json({ colleges, totals: { colleges: colleges.length, users: total("users"), labs: total("labs"), equipment: total("equipment"), approved: total("approved"), awaiting: total("awaiting"), events: total("events"), publishedEvents: total("publishedEvents"), files: total("files") } });
});

// ---- every lab and event, all colleges ----
router.get("/labs", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT l.id, c.code AS college, l.department, l.name, u.email AS coordinator, COUNT(q.id) AS total, SUM(q.status = 'submitted') AS awaiting, SUM(q.pub_data IS NOT NULL) AS approved
       FROM labs l JOIN colleges c ON c.id = l.college_id LEFT JOIN users u ON u.id = l.incharge_user_id LEFT JOIN equipment q ON q.lab_id = l.id
      WHERE (? IS NULL OR l.college_id = ?) GROUP BY l.id, c.code, u.email ORDER BY c.sort_order, l.department, l.name`, [req.scopeCollege, req.scopeCollege]);
  res.json({ labs: rows.map((r) => ({ ...r, total: n(r.total), awaiting: n(r.awaiting), approved: n(r.approved) })) });
});
router.get("/events", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT e.id, c.code AS college, e.name, e.type_key AS type, e.department, e.academic_year AS academicYear, e.status, COUNT(f.id) AS files, SUM(f.is_public) AS publicFiles,
            (SELECT u.email FROM users u WHERE u.event_id = e.id AND u.role = 'event_coordinator' LIMIT 1) AS coordinator
       FROM events e JOIN colleges c ON c.id = e.college_id LEFT JOIN event_files f ON f.event_id = e.id WHERE (? IS NULL OR e.college_id = ?) GROUP BY e.id, c.code ORDER BY c.sort_order, e.academic_year DESC, e.name`, [req.scopeCollege, req.scopeCollege]);
  res.json({ events: rows.map((r) => ({ ...r, files: n(r.files), publicFiles: n(r.publicFiles) })) });
});

// ---- users: list, create any type in any college, unlock / reset / set password / disable / edit / delete ----
router.get("/users", async (req, res) => {
  const where = [], params = [];
  if (req.scopeCollege) { where.push("u.college_id = ?"); params.push(req.scopeCollege); }
  else if (req.query.college) { where.push("c.code = ?"); params.push(String(req.query.college).toUpperCase()); }
  if (ROLES.includes(req.query.role)) { where.push("u.role = ?"); params.push(req.query.role); }
  if (["active", "disabled"].includes(req.query.status)) { where.push("u.status = ?"); params.push(req.query.status); }
  if (req.query.q) { where.push("(u.email LIKE ? OR u.name LIKE ? OR u.department LIKE ?)"); const q = `%${String(req.query.q).trim()}%`; params.push(q, q, q); }
  const [rows] = await pool.query(`${USER_SQL}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY c.sort_order, FIELD(u.role,'admin','college_admin','principal','hod','lab_incharge','event_coordinator','event_member'), u.department, u.email LIMIT 1000`, params);
  res.json({ users: rows });
});

router.post("/users", async (req, res) => {
  const b = req.body || {};
  const fields = {};
  const role = b.role;
  if (!ROLES.includes(role)) fields.role = "Choose the type of user.";
  const email = t(b.email, 190).toLowerCase();
  if (!emailOk(email)) fields.email = "Enter a valid email address.";
  const [[college]] = req.scopeCollege ? await pool.query("SELECT * FROM colleges WHERE id = ?", [req.scopeCollege]) : await pool.query("SELECT * FROM colleges WHERE code = ?", [String(b.college || "").toUpperCase()]);
  if (!college) fields.college = "Choose the college.";
  if (req.scopeCollege && role === "admin") fields.role = "Only the central administrator can create central administrators.";
  const password = t(b.password, 100) || defaultPassword();
  if (password.length < 8) fields.password = "Use at least 8 characters.";
  let department = t(b.department, 120) || null, labName = t(b.labName, 160) || null, event = null;
  if (role === "admin" && college && !college.is_central) fields.college = "Administrators belong to the central office.";
  if (role && role !== "admin" && college?.is_central) fields.college = "Choose a college, not the central office.";
  if (role === "hod" && !department) fields.department = "Enter the department.";
  if (role === "lab_incharge") { if (!department) fields.department = "Enter the department."; if (!labName) fields.labName = "Enter the lab name."; }
  if (role === "event_coordinator" || role === "event_member") {
    [[event]] = await pool.query("SELECT * FROM events WHERE id = ? AND college_id <=> ?", [Number(b.eventId) || 0, college?.id ?? null]);
    if (!event) fields.eventId = "Choose an event of this college.";
    else department = event.department;
  }
  if (!Object.keys(fields).length) {
    const [dup] = await pool.query("SELECT id FROM users WHERE college_id = ? AND email = ?", [college.id, email]);
    if (dup.length) fields.email = "That email already has an account in this college.";
  }
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please correct the highlighted fields.", fields });
  const name = t(b.name, 120) || { admin: "Administrator", college_admin: `${college.code} Administrator`, principal: `Principal, ${college.code}`, hod: `HOD, ${department}`, lab_incharge: `${labName} Coordinator`, event_coordinator: `${event?.name} Coordinator`, event_member: email.split("@")[0] }[role];
  const [ins] = await pool.query(
    "INSERT INTO users (college_id, name, email, password_hash, role, department, lab_name, event_id, created_by, must_change_password) VALUES (?,?,?,?,?,?,?,?,?,0)",
    [college.id, name, email, hashPassword(password), role, department, role === "lab_incharge" ? labName : null, event ? event.id : null, req.user.id]);
  if (role === "lab_incharge") {
    await pool.query("INSERT IGNORE INTO labs (college_id, department, name, incharge_user_id) VALUES (?,?,?,?)", [college.id, department, labName, ins.insertId]);
    await pool.query("UPDATE labs SET incharge_user_id = ? WHERE college_id = ? AND department = ? AND name = ? AND incharge_user_id IS NULL", [ins.insertId, college.id, department, labName]);
    const [[lab]] = await pool.query("SELECT id FROM labs WHERE college_id = ? AND department = ? AND name = ?", [college.id, department, labName]);
    await pool.query("UPDATE users SET lab_id = ? WHERE id = ?", [lab.id, ins.insertId]);
    try { require("../search/index").touch(); } catch { /* search optional */ }
  }
  const [[user]] = await pool.query(`${USER_SQL} WHERE u.id = ?`, [ins.insertId]);
  res.status(201).json({ user, initialPassword: password });
});

// A college administrator can only touch accounts of their own college (never the central administrators).
const loadUser = async (req) => {
  const [[u]] = await pool.query("SELECT * FROM users WHERE id = ?", [Number(req.params.id)]);
  return u && (!req.scopeCollege || (u.college_id === req.scopeCollege && u.role !== "admin")) ? u : null;
};
router.patch("/users/:id", async (req, res) => {
  const u = await loadUser(req);
  if (!u) return res.status(404).json({ error: "Account not found." });
  const { action } = req.body || {};
  const self = u.id === req.user.id;
  if (action === "reset" || action === "unlock") {
    // unlock = make the account usable again: enable it, back to the default password
    await pool.query("UPDATE users SET password_hash = ?, must_change_password = 0, status = 'active' WHERE id = ?", [hashPassword(defaultPassword()), u.id]);
    return res.json({ ok: true, initialPassword: defaultPassword() });
  }
  if (action === "setPassword") {
    const pw = String(req.body.password || "");
    if (pw.length < 8) return res.status(400).json({ error: "Use at least 8 characters.", fields: { password: "Use at least 8 characters." } });
    await pool.query("UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?", [hashPassword(pw), 0, u.id]);
    return res.json({ ok: true, initialPassword: pw });
  }
  if (action === "disable" || action === "enable") {
    if (self && action === "disable") return res.status(400).json({ error: "You cannot disable your own account." });
    await pool.query("UPDATE users SET status = ? WHERE id = ?", [action === "disable" ? "disabled" : "active", u.id]);
    return res.json({ ok: true });
  }
  if (action === "update") {
    // same rules as the Principal/HOD pages: email, name, lab name, and a HOD's department (carried over to its labs, equipment, coordinators and events)
    req.college = { id: u.college_id };
    return require("../org/routes").updateAccount(req, res, u);
  }
  res.status(400).json({ error: "Unknown action." });
});

router.delete("/users/:id", async (req, res) => {
  const u = await loadUser(req);
  if (!u) return res.status(404).json({ error: "Account not found." });
  if (u.id === req.user.id) return res.status(400).json({ error: "You cannot delete your own account." });
  if (u.role === "admin") {
    const [[{ c }]] = await pool.query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND status = 'active' AND id <> ?", [u.id]);
    if (!c) return res.status(400).json({ error: "There must always be at least one active administrator." });
  }
  await pool.query("UPDATE labs SET incharge_user_id = NULL WHERE incharge_user_id = ?", [u.id]);
  await pool.query("DELETE FROM users WHERE id = ?", [u.id]);
  try { require("../search/index").touch(); } catch { /* search optional */ }
  res.json({ ok: true });
});

module.exports = { router };

// Organisation module: colleges and the account hierarchy (admin > principal > HOD > lab coordinator).
// Every college shares this one implementation, mounted under /api/c/:college so each college has its own independent route space.
const express = require("express");
const pool = require("../../db/pool");
const { hashPassword } = require("../../core/security");
const { requireAuth, requireRole } = require("../../core/middleware");
const { CHILD_ROLE, defaultPassword } = require("../../core/org");

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const COLS = "id, name, email, role, department, lab_name AS labName, status, must_change_password AS mustChangePassword, created_at AS createdAt";

// ---- Public: colleges for the login form ----
const publicRouter = express.Router();
publicRouter.get("/", async (req, res) => {
  const [rows] = await pool.query("SELECT code, name, city, is_central AS isCentral FROM colleges ORDER BY sort_order");
  res.json({ colleges: rows });
});

// ---- Admin: overview of all colleges and their principal accounts ----
const adminRouter = express.Router();
adminRouter.get("/colleges", requireAuth, requireRole("admin"), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.code, c.name, c.city, c.is_central AS isCentral,
            (SELECT email FROM users p WHERE p.college_id = c.id AND p.role = 'principal' LIMIT 1) AS principalEmail,
            (SELECT status FROM users p WHERE p.college_id = c.id AND p.role = 'principal' LIMIT 1) AS principalStatus,
            (SELECT COUNT(*) FROM users h WHERE h.college_id = c.id AND h.role = 'hod') AS hods,
            (SELECT COUNT(*) FROM users l WHERE l.college_id = c.id AND l.role = 'lab_incharge') AS labs
       FROM colleges c WHERE c.is_central = 0 ORDER BY c.sort_order`);
  res.json({ colleges: rows });
});

// ---- Per-college routes ----
const collegeRouter = express.Router({ mergeParams: true });

// Loads the college and a fresh copy of the caller; enforces that people only act inside their own college.
collegeRouter.use(requireAuth, async (req, res, next) => {
  try {
    const [[college]] = await pool.query("SELECT * FROM colleges WHERE code = ?", [String(req.params.college).toUpperCase()]);
    if (!college) return res.status(404).json({ error: "Unknown college." });
    const [[me]] = await pool.query("SELECT * FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
    if (!me) return res.status(401).json({ error: "Session expired." });
    if (me.role !== "admin" && me.college_id !== college.id) return res.status(403).json({ error: "You do not have access to this college." });
    if (me.must_change_password) return res.status(403).json({ error: "Please change your default password first." });
    req.college = college; req.me = me;
    next();
  } catch (err) { console.error("college ctx:", err.message); res.status(500).json({ error: "Server error." }); }
});

// Which accounts the caller manages, as a SQL condition.
function scope(me, college) {
  const role = CHILD_ROLE[me.role];
  if (!role) return null;
  if (me.role === "hod") {
    if (!me.department) return null;
    return { role, where: "college_id = ? AND role = ? AND department = ?", params: [college.id, role, me.department] };
  }
  return { role, where: "college_id = ? AND role = ?", params: [college.id, role] };
}
const needScope = (req, res, next) => {
  req.scope = scope(req.me, req.college);
  req.scope ? next() : res.status(403).json({ error: "Your role does not manage other accounts." });
};

collegeRouter.get("/users", needScope, async (req, res) => {
  const [rows] = await pool.query(`SELECT ${COLS} FROM users WHERE ${req.scope.where} ORDER BY department, lab_name, email`, req.scope.params);
  res.json({ college: { code: req.college.code, name: req.college.name }, childRole: req.scope.role, users: rows });
});

collegeRouter.post("/users", needScope, async (req, res) => {
  const { me, college } = req;
  if (me.role === "admin") return res.status(403).json({ error: "Principal accounts are created automatically. Use reset instead." });
  const b = req.body || {};
  const email = String(b.email || "").trim().toLowerCase();
  const fields = {};
  if (!emailOk(email)) fields.email = "Enter a valid email address.";
  let department = null, labName = null;
  if (me.role === "principal") {
    department = String(b.department || "").trim();
    if (department.length < 2) fields.department = "Enter the department.";
  } else {
    department = me.department;
    labName = String(b.labName || "").trim();
    if (labName.length < 2) fields.labName = "Enter the lab name.";
  }
  const password = String(b.password || "").trim() || defaultPassword();
  if (password.length < 8) fields.password = "Use at least 8 characters.";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please correct the highlighted fields.", fields });

  const [dup] = await pool.query("SELECT id FROM users WHERE college_id = ? AND email = ?", [college.id, email]);
  if (dup.length) return res.status(409).json({ error: "That email already has an account in this college.", fields: { email: "That email already has an account in this college." } });
  const role = req.scope.role;
  const name = String(b.name || "").trim() || (role === "hod" ? `HOD, ${department}` : `${labName} Coordinator`);
  const [ins] = await pool.query(
    "INSERT INTO users (college_id, name, email, password_hash, role, department, lab_name, created_by, must_change_password) VALUES (?,?,?,?,?,?,?,?,1)",
    [college.id, name, email, hashPassword(password), role, department, labName, me.id]
  );
  const [[user]] = await pool.query(`SELECT ${COLS} FROM users WHERE id = ?`, [ins.insertId]);
  res.status(201).json({ user, initialPassword: password });
});

// action: reset (back to default password) | disable | enable
collegeRouter.patch("/users/:id", needScope, async (req, res) => {
  const [[target]] = await pool.query(`SELECT id FROM users WHERE id = ? AND ${req.scope.where}`, [Number(req.params.id), ...req.scope.params]);
  if (!target) return res.status(404).json({ error: "Account not found." });
  const { action } = req.body || {};
  if (action === "reset") {
    await pool.query("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?", [hashPassword(defaultPassword()), target.id]);
    return res.json({ ok: true, initialPassword: defaultPassword() });
  }
  if (action === "disable" || action === "enable") {
    await pool.query("UPDATE users SET status = ? WHERE id = ?", [action === "disable" ? "disabled" : "active", target.id]);
    return res.json({ ok: true });
  }
  res.status(400).json({ error: "Unknown action." });
});

module.exports = { publicRouter, adminRouter, collegeRouter };

const express = require("express");
const pool = require("../../db/pool");
const { hashPassword, verifyPassword, signToken } = require("../../core/security");
const { requireAuth, rateLimit } = require("../../core/middleware");
const { defaultPassword } = require("../../core/org");

const router = express.Router();
const publicUser = (u, c) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, department: u.department || null, labName: u.lab_name || null, eventId: u.event_id || null,
  mustChangePassword: !!u.must_change_password, college: { id: c.id, code: c.code, name: c.name },
});
const session = (u, c) => ({ token: signToken({ id: u.id, role: u.role, name: u.name, college_id: c.id, college: c.code }), user: publicUser(u, c) });

// Same login for every type of user: college + email + password.
router.post("/login", rateLimit({ max: 20 }), async (req, res) => {
  const { college = "", email = "", password = "" } = req.body || {};
  try {
    const [[c]] = await pool.query("SELECT * FROM colleges WHERE code = ?", [String(college).trim().toUpperCase()]);
    if (!c) return res.status(400).json({ error: "Please choose your college.", fields: { college: "Please choose your college." } });
    const [[u]] = await pool.query("SELECT * FROM users WHERE college_id = ? AND email = ?", [c.id, String(email).trim().toLowerCase()]);
    if (!u || u.status !== "active" || !verifyPassword(String(password), u.password_hash)) return res.status(401).json({ error: "Incorrect college, email or password." });
    res.json(session(u, c));
  } catch (err) {
    console.error("login:", err.message);
    res.status(500).json({ error: "Could not sign in right now." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const [[u]] = await pool.query("SELECT * FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (!u) return res.status(401).json({ error: "Session expired." });
  const [[c]] = await pool.query("SELECT * FROM colleges WHERE id = ?", [u.college_id]);
  res.json({ user: publicUser(u, c) });
});

router.post("/change-password", requireAuth, rateLimit({ max: 10 }), async (req, res) => {
  const { current = "", next = "" } = req.body || {};
  const fields = {};
  if (String(next).length < 8) fields.next = "Use at least 8 characters.";
  else if (next === defaultPassword()) fields.next = "Choose a password different from the default.";
  else if (next === current) fields.next = "The new password must differ from the current one.";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please correct the highlighted fields.", fields });
  const [[u]] = await pool.query("SELECT * FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (!u || !verifyPassword(String(current), u.password_hash)) return res.status(400).json({ error: "Your current password is incorrect.", fields: { current: "Your current password is incorrect." } });
  await pool.query("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?", [hashPassword(next), u.id]);
  res.json({ ok: true });
});

module.exports = router;

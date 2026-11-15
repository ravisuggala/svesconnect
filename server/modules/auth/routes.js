const express = require("express");
const pool = require("../../db/pool");
const { hashPassword, verifyPassword, signToken } = require("../../core/security");
const { requireAuth, rateLimit } = require("../../core/middleware");

const router = express.Router();
const SELF_ROLES = ["student", "faculty", "external"]; // higher roles are assigned by an admin
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const session = (u) => ({ token: signToken({ id: u.id, role: u.role, name: u.name }), user: publicUser(u) });

router.post("/register", rateLimit({ max: 10 }), async (req, res) => {
  const { name = "", email = "", password = "", role = "student" } = req.body || {};
  const fields = {};
  if (name.trim().length < 2) fields.name = "Enter your full name.";
  if (!emailOk(email)) fields.email = "Enter a valid email address.";
  if (String(password).length < 8) fields.password = "Use at least 8 characters.";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please correct the highlighted fields.", fields });
  try {
    const e = email.trim().toLowerCase();
    const [dup] = await pool.query("SELECT id FROM users WHERE email = ?", [e]);
    if (dup.length) return res.status(409).json({ error: "That email is already registered.", fields: { email: "That email is already registered." } });
    const r = SELF_ROLES.includes(role) ? role : "student";
    const [ins] = await pool.query("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)", [name.trim(), e, hashPassword(password), r]);
    res.status(201).json(session({ id: ins.insertId, name: name.trim(), email: e, role: r }));
  } catch (err) {
    console.error("register:", err.message);
    res.status(500).json({ error: "Could not create the account right now." });
  }
});

router.post("/login", rateLimit({ max: 20 }), async (req, res) => {
  const { email = "", password = "" } = req.body || {};
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [String(email).trim().toLowerCase()]);
    const u = rows[0];
    if (!u || u.status !== "active" || !verifyPassword(String(password), u.password_hash)) return res.status(401).json({ error: "Incorrect email or password." });
    res.json(session(u));
  } catch (err) {
    console.error("login:", err.message);
    res.status(500).json({ error: "Could not sign in right now." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const [rows] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  rows[0] ? res.json({ user: rows[0] }) : res.status(401).json({ error: "Session expired." });
});

module.exports = router;

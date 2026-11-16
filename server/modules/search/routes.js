const express = require("express");
const pool = require("../../db/pool");
const { rateLimit } = require("../../core/middleware");
const index = require("./index");

const router = express.Router();

// Who is asking decides what they can search: the public sees published items only; HOD their department; Principal their college.
async function scopeFor(req, wantPublic) {
  const pub = { mode: "public", label: "All published SVES labs" };
  if (wantPublic || !req.user) return pub;
  const [[u]] = await pool.query("SELECT u.id, u.role, u.college_id, u.department, u.lab_id, u.must_change_password, c.code, c.name AS college FROM users u JOIN colleges c ON c.id = u.college_id WHERE u.id = ? AND u.status = 'active'", [req.user.id]);
  if (!u || u.must_change_password) return pub;
  if (u.role === "admin") return { mode: "all", label: "All SVES colleges (including pending records)" };
  if (u.role === "principal") return { mode: "college", collegeId: u.college_id, label: `${u.college}, all departments` };
  if (u.role === "hod") return { mode: "college", collegeId: u.college_id, department: u.department, label: `${u.code}, ${u.department} department` };
  if (u.role === "lab_incharge") return { mode: "college", collegeId: u.college_id, labId: u.lab_id, label: `${u.code}, your lab` };
  return pub;
}

// GET /api/search?q=...&scope=public|mine
router.get("/", rateLimit({ max: 60 }), async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 300);
  if (q.length < 2) return res.status(400).json({ error: "Type at least two characters." });
  try {
    const scope = await scopeFor(req, req.query.scope === "public");
    const r = await index.search(q, scope, 12);
    res.json({ query: q, scope: { mode: scope.mode === "public" ? "public" : "mine", label: scope.label }, searchMode: r.mode, results: r.results.map((e) => index.present(e, scope)) });
  } catch (err) { console.error("search:", err.message); res.status(500).json({ error: "Search failed." }); }
});

router.get("/status", (req, res) => res.json({ entries: index.size(), mode: index.mode() }));

module.exports = { router, scopeFor };

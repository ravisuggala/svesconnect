// Shared request context for /api/c/:college/* routes: loads the college and a fresh copy of the caller,
// and enforces that people only act inside their own college (admins may enter any).
const pool = require("../db/pool");
const { requireAuth } = require("./middleware");

const collegeContext = [requireAuth, async (req, res, next) => {
  try {
    const [[college]] = await pool.query("SELECT * FROM colleges WHERE code = ?", [String(req.params.college).toUpperCase()]);
    if (!college) return res.status(404).json({ error: "Unknown college." });
    const [[me]] = await pool.query("SELECT * FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
    if (!me) return res.status(401).json({ error: "Session expired." });
    if (me.role !== "admin" && me.college_id !== college.id) return res.status(403).json({ error: "You do not have access to this college." });
    if (me.must_change_password) return res.status(403).json({ error: "Please change your default password first." });
    // A college administrator has full administrator rights, but only inside their own college (checked just above); inside it they are treated as the administrator.
    if (me.role === "college_admin") { me.role = "admin"; me.college_admin = true; }
    req.college = college; req.me = me;
    next();
  } catch (err) { console.error("college ctx:", err.message); res.status(500).json({ error: "Server error." }); }
}];

module.exports = { collegeContext };

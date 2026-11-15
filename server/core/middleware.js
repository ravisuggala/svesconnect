const { verifyToken } = require("./security");

// Attaches req.user if a valid Bearer token is present (never blocks).
function optionalAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (m) { try { req.user = verifyToken(m[1]) || undefined; } catch { /* misconfigured secret: treat as anonymous */ } }
  next();
}
const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "Please sign in." }));
const requireRole = (...roles) => (req, res, next) => (req.user && roles.includes(req.user.role) ? next() : res.status(403).json({ error: "Not allowed." }));

// Tiny in-memory rate limiter (per IP) for sensitive endpoints.
function rateLimit({ windowMs = 60000, max = 20 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const rec = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    rec.push(now); hits.set(req.ip, rec);
    return rec.length > max ? res.status(429).json({ error: "Too many requests. Please wait a minute." }) : next();
  };
}

module.exports = { optionalAuth, requireAuth, requireRole, rateLimit };

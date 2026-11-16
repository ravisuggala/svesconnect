const path = require("path");
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
}
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");
const { optionalAuth } = require("./core/middleware");
const chatbot = require("./modules/chatbot/routes");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(optionalAuth);

// ---- Module APIs: each module mounts under /api/<module> ----
const org = require("./modules/org/routes");
app.use("/api/auth", require("./modules/auth/routes"));
app.use("/api/colleges", org.publicRouter);
app.use("/api/admin", org.adminRouter);
app.use("/api/c/:college", org.collegeRouter);
app.use("/api/chatbot", chatbot.router);

app.get("/api/health", async (req, res) => {
  let db = false;
  try { await pool.query("SELECT 1"); db = true; } catch { /* db down */ }
  res.json({ ok: true, db, vectors: chatbot.size() });
});

// ---- Serve built frontend (production: npm run build && npm start) ----
const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  pool.query("SELECT 1")
    .then(() => { console.log("MySQL connected"); return chatbot.ingest(); })
    .then((n) => console.log(`Vector store auto-ingested (${n} items)`))
    .catch((err) => console.log("Startup DB/ingest problem:", err.message));
});

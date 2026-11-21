// Dashboards module: role-based analytics. Principal/administrator: whole college; HOD: own department.
const express = require("express");
const { collegeContext } = require("../../core/college");
const { rateLimit } = require("../../core/middleware");
const engine = require("./engine");
const ask = require("./ask");

const collegeRouter = express.Router({ mergeParams: true });
collegeRouter.use("/insights", collegeContext);
const allowed = (req, res, next) => (["principal", "hod", "admin"].includes(req.me.role) ? next() : res.status(403).json({ error: "The dashboard is for the Principal and the HODs." }));
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => { console.error("insights:", err.message); res.status(500).json({ error: "Something went wrong while preparing this. Please try again." }); });

collegeRouter.get("/insights/dashboard", allowed, wrap(async (req, res) => res.json(await engine.dashboard(req.me, req.college))));
collegeRouter.get("/insights/options", allowed, wrap(async (req, res) => res.json(await engine.options(req.me, req.college))));
collegeRouter.post("/insights/query", allowed, wrap(async (req, res) => res.json(await engine.run(req.me, req.college, req.body?.request, req.body?.finance !== false))));
collegeRouter.post("/insights/ask", allowed, rateLimit({ max: 60 }), wrap(async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim().slice(0, 400);
  if (prompt.length < 2) return res.status(400).json({ error: "Please type what you would like to see." });
  const opt = await engine.options(req.me, req.college);
  const { request, mode } = await ask.understand(prompt, opt);
  const result = await engine.run(req.me, req.college, request, req.body?.finance !== false);
  const narrative = await ask.narrate(prompt, result);
  res.json({ ...result, prompt, mode, narrative: narrative.text, narrativeAi: narrative.ai });
}));

module.exports = { collegeRouter };

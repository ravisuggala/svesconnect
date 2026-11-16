// AI assistant: retrieval (see ../search) + an answer written by the Groq LLM when a key is configured.
// Without a key (or if the LLM is down) it answers with the best-matching records, so it is still useful.
const express = require("express");
const axios = require("axios");
const { rateLimit } = require("../../core/middleware");
const index = require("../search/index");
const { scopeFor } = require("../search/routes");

const router = express.Router();
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

async function askLLM(prompt) {
  if (!process.env.GROK_API_KEY) return null;
  try {
    const r = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      { model: GROQ_MODEL, messages: [{ role: "system", content: "You are an infrastructure assistant." }, { role: "user", content: prompt }], temperature: 0.3, max_tokens: 400 },
      { headers: { Authorization: `Bearer ${process.env.GROK_API_KEY}`, "Content-Type": "application/json" }, timeout: 20000 });
    return r.data.choices[0].message.content;
  } catch (err) {
    console.error("Groq error:", err.response?.data || err.message);
    return null;
  }
}

router.get("/ingest", async (req, res) => {
  try { res.send(`Search index rebuilt (${await index.refresh()} items)`); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/chat", rateLimit({ max: 30 }), async (req, res) => {
  const { question, scope: want } = req.body || {};
  if (!question || !String(question).trim()) return res.status(400).json({ error: "Question required" });
  try {
    const scope = await scopeFor(req, want === "public");
    const { results, mode } = await index.search(String(question).slice(0, 500), scope, 6);
    const base = { scope: { mode: scope.mode === "public" ? "public" : "mine", label: scope.label }, searchMode: mode };
    if (!results.length) return res.json({ ...base, answer: `I could not find anything about that in: ${scope.label}.`, sources: [] });
    const sources = results.slice(0, 5).map((e) => index.present(e, scope));
    const context = results.slice(0, 4).map((e) => e.text).join("\n---\n");
    const llm = await askLLM(`
You are an infrastructure assistant for SVES institutions.

Answer ONLY using the information inside CONTEXT. Mention the lab and department when relevant.

If the answer is not present in CONTEXT, say:
"I do not have that information in the database."

CONTEXT:
${context}

QUESTION:
${question}
`);
    const answer = llm || `Closest matches in ${scope.label}:\n` + sources.map((s) => `• ${s.title} (${s.subtitle})`).join("\n");
    res.json({ ...base, answer, sources, ai: !!llm });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Chat failed" });
  }
});

module.exports = { router };

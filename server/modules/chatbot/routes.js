// Module 2: AI assistant (retrieval-augmented). Embeddings run locally; answers come from Groq's OpenAI-compatible API.
const express = require("express");
const axios = require("axios");
const pool = require("../../db/pool");
const { rateLimit } = require("../../core/middleware");

const router = express.Router();
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const queryCache = new Map();
let embedder = null;
let vectorStore = [];

async function createEmbedding(text) {
  if (!embedder) {
    console.log("Loading embedding model...");
    // Loaded lazily so the rest of the site still starts if this optional AI library (or its native sharp binary) is unavailable.
    const { pipeline } = require("@xenova/transformers");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("Embedding model loaded");
  }
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

async function ingest() {
  const [rows] = await pool.query("SELECT name, category, department, description, specifications, location FROM equipment");
  const store = [];
  for (const eq of rows) {
    const text = `
Name: ${eq.name}
Category: ${eq.category}
Department: ${eq.department}
Description: ${eq.description}
Specifications: ${eq.specifications}
Location: ${eq.location}
`;
    store.push({ embedding: await createEmbedding(text), text });
  }
  vectorStore = store.slice(0, 20000);
  return vectorStore.length;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function askLLM(prompt) {
  try {
    const r = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      { model: GROQ_MODEL, messages: [{ role: "system", content: "You are an infrastructure assistant." }, { role: "user", content: prompt }], temperature: 0.3, max_tokens: 300 },
      { headers: { Authorization: `Bearer ${process.env.GROK_API_KEY}`, "Content-Type": "application/json" } }
    );
    return r.data.choices[0].message.content;
  } catch (err) {
    console.error("Groq error:", err.response?.data || err.message);
    return "AI service unavailable.";
  }
}

router.get("/ingest", async (req, res) => {
  try { res.send(`Vector store created (${await ingest()} items)`); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/chat", rateLimit({ max: 30 }), async (req, res) => {
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: "Question required" });
  try {
    if (vectorStore.length === 0) return res.json({ answer: "Knowledge base is empty or still loading. Please try again shortly." });
    let q = queryCache.get(question);
    if (!q) { q = await createEmbedding(question); queryCache.set(question, q); }
    const context = vectorStore
      .map((v) => ({ text: v.text, score: cosine(q, v.embedding) }))
      .sort((a, b) => b.score - a.score).slice(0, 3).map((s) => s.text).join("\n");
    const answer = await askLLM(`
You are an infrastructure assistant.

Answer ONLY using the information inside CONTEXT.

If the answer is not present in CONTEXT, say:
"I do not have that information in the database."

CONTEXT:
${context}

QUESTION:
${question}
`);
    pool.query("INSERT INTO chat_logs (user_id, message, response) VALUES (?,?,?)", [req.user?.id || null, question, answer]).catch(() => {});
    res.json({ answer });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Chat failed" });
  }
});

module.exports = { router, ingest, size: () => vectorStore.length };

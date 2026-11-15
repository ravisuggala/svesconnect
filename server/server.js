const path = require("path");
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
}
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");
const { pipeline } = require("@xenova/transformers");
const Equipment = require("./models/Equipment");

const app = express();
const port = process.env.PORT || 5000;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const queryCache = new Map();

app.use(cors());
app.use(express.json());

// ---------- Embeddings / in-memory vector store ----------
let embedder = null;
async function getEmbedder() {
  if (!embedder) {
    console.log("Loading embedding model...");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("Embedding model loaded");
  }
  return embedder;
}

async function createEmbedding(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

let vectorStore = [];

async function ingest() {
  const equipments = await Equipment.find();
  const store = [];
  for (const eq of equipments) {
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

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------- LLM (Groq, OpenAI-compatible) ----------
async function askGrok(prompt) {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "You are an infrastructure assistant." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROK_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (err) {
    console.error("Groq Error:", err.response?.data || err.message);
    return "AI service unavailable.";
  }
}

// ---------- API ----------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1, vectors: vectorStore.length });
});

app.get("/api/ingest", async (req, res) => {
  try {
    const count = await ingest();
    res.send(`Vector store created (${count} items)`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chatbot/chat", async (req, res) => {
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: "Question required" });

  try {
    if (vectorStore.length === 0) {
      return res.json({ answer: "Knowledge base is empty or still loading. Please try again shortly." });
    }

    let qEmbedding = queryCache.get(question);
    if (!qEmbedding) {
      qEmbedding = await createEmbedding(question);
      queryCache.set(question, qEmbedding);
    }

    const context = vectorStore
      .map((v) => ({ text: v.text, score: cosineSimilarity(qEmbedding, v.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.text)
      .join("\n");

    const prompt = `
You are an infrastructure assistant.

Answer ONLY using the information inside CONTEXT.

If the answer is not present in CONTEXT, say:
"I do not have that information in the database."

CONTEXT:
${context}

QUESTION:
${question}
`;
    res.json({ answer: await askGrok(prompt) });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Chat failed" });
  }
});

// ---------- Serve built frontend (production: npm run build && npm start) ----------
const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

// ---------- Start ----------
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");
    try {
      console.log(`Vector store auto-ingested (${await ingest()} items)`);
    } catch (err) {
      console.log("Auto ingest failed:", err.message);
    }
  })
  .catch((err) => console.log("DB error:", err.message));

app.listen(port, () => console.log(`Server running on port ${port}`));

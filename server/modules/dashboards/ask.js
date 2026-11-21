// Turns a sentence into a structured request (engine.normalize validates it) and writes a short summary of the exact result.
// With GROK_API_KEY the Groq model understands free sentences; without it a keyword reader handles the common questions.
const axios = require("axios");
const engine = require("./engine");

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
async function groq(system, user, max = 400, json = false) {
  if (!process.env.GROK_API_KEY) return null;
  try {
    const r = await axios.post("https://api.groq.com/openai/v1/chat/completions",
      { model: GROQ_MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: max, ...(json ? { response_format: { type: "json_object" } } : {}) },
      { headers: { Authorization: `Bearer ${process.env.GROK_API_KEY}`, "Content-Type": "application/json" }, timeout: 20000 });
    return String(r.data.choices?.[0]?.message?.content || "").trim();
  } catch (err) { console.error("Groq dashboard error:", err.response?.data || err.message); return null; }
}

const SCHEMA = `Return ONLY a JSON object: {"entity": one of equipment|labs|incharges|departments|hods|events, "groupBy": one of department|lab|type|equipment|incharge|year|month|null,
"filters": {"department":str,"lab":str,"incharge":str,"type":str,"equipment":str,"q":str,"condition": working|repair|not_in_use|not_working,"status": published|pending|draft|sent_back,"year":int,"month":1-12,"from":"YYYY-MM-DD","to":"YYYY-MM-DD","boughtFrom":int,"boughtTo":int}}.
Omit filters that are not asked for. Meaning: "incharges" = lab in-charges / faculty; "hods" = heads of department; "year"/"month"/"from"/"to" refer to when the record was added (events: event date); "boughtFrom/boughtTo" are purchase years; "not working" = not_working; "under repair" = repair.`;

// ---- keyword fallback ----
function keywordRequest(prompt, opt) {
  const p = ` ${prompt.toLowerCase()} `;
  const has = (...w) => w.some((x) => p.includes(x));
  const r = { entity: "equipment", groupBy: null, filters: {} };
  if (has("hod", "head of department", "heads of department")) r.entity = "hods";
  else if (has("in-charge", "incharge", "in charge", "coordinator", "faculty")) r.entity = "incharges";
  else if (has("event", "workshop", "fest", "baja")) r.entity = "events";
  else if (has("departments", "department details", "department summary", "summary", "overview")) r.entity = "departments";
  else if (has(" labs ", " lab details", "lab wise", "lab-wise", " lab list")) r.entity = "labs";
  if (has("not working", "non working", "non-working", "not-working", "broken", "faulty", "down")) r.filters.condition = "not_working";
  else if (has("repair")) r.filters.condition = "repair";
  else if (has("not in use", "unused", "idle")) r.filters.condition = "not_in_use";
  else if (has(" working", "functional")) r.filters.condition = "working";
  if (has("awaiting", "pending", "waiting for approval")) r.filters.status = "pending";
  else if (has("sent back", "rejected")) r.filters.status = "sent_back";
  else if (has("published")) r.filters.status = "published";
  else if (has("draft")) r.filters.status = "draft";
  const dep = opt.departments.find((d) => p.includes(` ${d.toLowerCase()} `) || p.includes(`${d.toLowerCase()} department`) || p.includes(`${d.toLowerCase()}.`) || p.includes(` ${d.toLowerCase()}?`) || p.endsWith(` ${d.toLowerCase()} `));
  if (dep) r.filters.department = dep;
  const type = opt.types.find((t) => p.includes(t.toLowerCase().split(/[ &(]/)[0]) && t.length > 3 && t.toLowerCase().split(/[ &(]/)[0].length > 4);
  if (type && r.entity === "equipment") r.filters.type = type;
  const name = opt.names.find((n) => n.length > 2 && p.includes(n.toLowerCase()));
  if (name && r.entity !== "events") r.filters.equipment = name;
  const months = engine.MONTHS; const mi = months.findIndex((m) => p.includes(` ${m} `) || p.includes(` ${m.slice(0, 3)} `));
  if (mi >= 0) r.filters.month = mi + 1;
  const years = [...p.matchAll(/\b(19|20)\d\d\b/g)].map((m) => Number(m[0]));
  const bought = has("bought", "purchased", "purchase");
  if (years.length) {
    if (has("after", "since", "from")) r.filters[bought ? "boughtFrom" : "year"] = years[0] + (has("after") && bought ? 1 : 0);
    if (has("before", "until", "till")) { r.filters[bought ? "boughtTo" : "year"] = years[0] - (has("before") ? 1 : 0); }
    if (!has("after", "since", "before", "until", "till", "from")) { if (bought) { r.filters.boughtFrom = years[0]; r.filters.boughtTo = years[0]; } else r.filters.year = years[0]; }
    if (!bought && (has("after", "since", "from"))) { delete r.filters.year; r.filters.from = `${years[0]}-01-01`; }
    if (!bought && has("before", "until", "till")) { delete r.filters.year; r.filters.to = `${years[0] - 1}-12-31`; }
  }
  if (has("this year")) r.filters.year = new Date().getFullYear();
  if (has("last year")) r.filters.year = new Date().getFullYear() - 1;
  if (has("department wise", "department-wise", "by department", "each department")) r.groupBy = "department";
  else if (has("lab wise", "lab-wise", "by lab", "each lab")) r.groupBy = "lab";
  else if (has("month wise", "month-wise", "by month", "monthly", "each month")) r.groupBy = "month";
  else if (has("year wise", "year-wise", "by year", "yearly", "each year")) r.groupBy = "year";
  else if (has("type wise", "type-wise", "by type", "category wise")) r.groupBy = "type";
  else if (has("faculty wise", "faculty-wise", "incharge wise", "in-charge wise", "by in-charge", "by faculty")) r.groupBy = "incharge";
  else if (has("equipment wise", "equipment-wise", "by equipment")) r.groupBy = "equipment";
  if (r.entity === "departments" || r.entity === "hods" || r.entity === "labs" || r.entity === "incharges") r.groupBy = null;
  return r;
}

async function understand(prompt, opt) {
  const sys = `You convert a college principal's question into a data request.\n${SCHEMA}\nKnown departments: ${opt.departments.join(", ") || "none"}. Known equipment types: ${opt.types.join(", ") || "none"}. Use the exact department / type spelling from these lists when the question refers to one.`;
  const raw = await groq(sys, prompt, 300, true);
  if (raw) { try { const j = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "")); if (j && typeof j === "object") return { request: j, mode: "ai" }; } catch { /* fall through to keywords */ } }
  return { request: keywordRequest(prompt, opt), mode: "basic" };
}

function templateNarrative(res) {
  const t = res.totals || {}, n = res.rows.length;
  if (!n) return "Nothing matches this request. Try removing a filter or choosing another date range.";
  const bits = [`Found ${res.request.groupBy ? `${n} groups` : `${n} ${n === 1 ? "record" : "records"}`}`];
  if (t.units !== undefined) bits.push(`${t.units} units in total (${t.working || 0} working, ${t.repair || 0} needing repair, ${t.notInUse || 0} not in use)`);
  return `${bits.join(": ")}.`;
}
async function narrate(prompt, res) {
  const base = templateNarrative(res);
  if (!res.rows.length || !process.env.GROK_API_KEY) return { text: base, ai: false };
  const facts = JSON.stringify({ question: prompt, understoodAs: res.understood, totals: res.totals, rowCount: res.rows.length, firstRows: res.rows.slice(0, 12).map((r) => Object.fromEntries(Object.entries(r).filter(([k, v]) => typeof v !== "object" && !["id", "labId", "added", "approved", "status", "published", "unknown", "inchargeEmail", "email"].includes(k)))) });
  const text = await groq("You summarise exact data for a college principal in 2 to 3 plain sentences. Use ONLY the numbers and names in the JSON. Never invent or round numbers. Do not repeat the question.", facts, 220);
  return text && text.length > 20 ? { text, ai: true } : { text: base, ai: false };
}

module.exports = { understand, narrate };

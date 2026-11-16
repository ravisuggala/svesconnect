// Pulls readable text out of uploaded files (no extra packages: Node's zlib only) and summarises it.
// Summaries are extractive (the most informative sentences), so they work without any AI key.
const zlib = require("zlib");

const unxml = (x) => x.replace(/<\/(?:w|a):p>|<w:br\/>|<\/si>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function zipEntries(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) return [];
  const count = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const out = [];
  for (let i = 0; i < count && p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    out.push({ name: buf.toString("utf8", p + 46, p + 46 + nlen), method, csize, off });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}
function zipRead(buf, ent) {
  const nlen = buf.readUInt16LE(ent.off + 26), xlen = buf.readUInt16LE(ent.off + 28), s = ent.off + 30 + nlen + xlen;
  const raw = buf.subarray(s, s + ent.csize);
  return ent.method === 8 ? zlib.inflateRawSync(raw) : raw;
}
function officeText(buf, pattern) {
  let out = "";
  for (const ent of zipEntries(buf).filter((x) => pattern.test(x.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
    out += unxml(zipRead(buf, ent).toString("utf8")) + "\n";
    if (out.length > 60000) break;
  }
  return out;
}
function pdfText(buf) {
  const s = buf.toString("latin1");
  let out = "";
  for (const m of s.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let body;
    try { body = zlib.inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"); } catch { continue; }
    // Linear-time patterns only (nested quantifiers here can hang on large PDFs).
    for (const t of body.matchAll(/\(([^()]{1,400})\)\s*Tj|\[([^\]]{1,4000})\]\s*TJ/g)) {
      const part = t[1] ?? [...(t[2] || "").matchAll(/\(([^()]{0,400})\)/g)].map((x) => x[1]).join("");
      out += part.replace(/\\([()\\])/g, "$1") + " ";
    }
    if (out.length > 60000) break;
  }
  return out;
}

function extractText(buf, ext) {
  try {
    if (["txt", "md", "csv"].includes(ext)) return buf.subarray(0, 60000).toString("utf8");
    if (ext === "docx") return officeText(buf, /^word\/document\.xml$/);
    if (ext === "pptx") return officeText(buf, /^ppt\/slides\/slide\d+\.xml$/);
    if (ext === "xlsx") return officeText(buf, /^xl\/sharedStrings\.xml$/);
    if (ext === "pdf") return pdfText(buf);
  } catch { /* unreadable: the summary then falls back to the metadata */ }
  return "";
}

const STOP = new Set("the a an of for to in on at and or with from by is are was were be been this that these those it its as we our their his her they you your will shall can may also has have had not but if then than into over under about which who whom what when where how all any each such more most other some".split(" "));
const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();

/** Top `n` informative sentences, in their original order, capped at `max` characters in total. */
function summarize(text, n = 2, max = 420) {
  // Only sentences that read like prose (rejects garbled PDF text, tables of numbers and symbols).
  const prose = (x) => (x.match(/[A-Za-z ,.'-]/g) || []).length / x.length >= 0.9 && (x.match(/\b[a-z]{3,}\b/gi) || []).length >= 6;
  const sentences = clean(text).split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map((s) => s.trim()).filter((s) => s.length >= 40 && s.length <= 320 && prose(s));
  if (!sentences.length) return "";
  const freq = {};
  for (const w of clean(text).toLowerCase().match(/[a-z]{4,}/g) || []) if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  const scored = sentences.slice(0, 80).map((s, i) => {
    const ws = (s.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !STOP.has(w));
    return { s, i, score: ws.reduce((a, w) => a + (freq[w] || 0), 0) / Math.sqrt(ws.length || 1) + (i < 3 ? 1.5 : 0) };
  });
  const picked = scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s).join(" ");
  return picked.length > max ? `${picked.slice(0, max - 1).trim()}…` : picked;
}

module.exports = { extractText, summarize, clean };

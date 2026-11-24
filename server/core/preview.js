// Read-only previews of Word (.docx) and Excel (.xlsx) uploads, built with Node's zlib only (no extra packages).
// The browser cannot show these formats itself, so the server turns them into plain blocks / rows that the
// proof viewer draws. Old binary .doc / .xls files cannot be read this way and answer { type: "none" }.
const zlib = require("zlib");

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
const readEntry = (buf, entries, name) => { const e = entries.find((x) => x.name === name); return e ? zipRead(buf, e).toString("utf8") : ""; };
const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&");
const textOf = (xml) => unesc(xml.replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<(?!\/?w:t[ >])[^>]*>/g, "").replace(/<[^>]+>/g, ""));

const MAX_BLOCKS = 600, MAX_CHARS = 80000;

function docx(buf) {
  const xml = readEntry(buf, zipEntries(buf), "word/document.xml");
  if (!xml) return { type: "none" };
  const blocks = [];
  let chars = 0;
  for (const m of xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g)) {
    if (blocks.length >= MAX_BLOCKS || chars > MAX_CHARS) break;
    const s = m[0];
    if (s.startsWith("<w:tbl>")) {
      const rows = [...s.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((r) => [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => textOf(c[0]).trim()));
      chars += rows.flat().join("").length;
      blocks.push({ t: "table", rows });
    } else {
      const text = textOf(s).trim();
      if (!text) continue;
      chars += text.length;
      const h = /<w:pStyle w:val="(?:Heading|Title)/i.test(s);
      blocks.push({ t: "p", text, h });
    }
  }
  return { type: "doc", blocks };
}

const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/[^A-Z]/gi, "").toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

function xlsx(buf) {
  const entries = zipEntries(buf);
  const wb = readEntry(buf, entries, "xl/workbook.xml");
  if (!wb) return { type: "none" };
  const rels = {};
  for (const m of readEntry(buf, entries, "xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]*)"/.exec(m[0])?.[1], target = /\bTarget="([^"]*)"/.exec(m[0])?.[1];
    if (id && target) rels[id] = target.replace(/^\/?(xl\/)?/, "xl/");
  }
  const shared = [...readEntry(buf, entries, "xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  const sheets = [];
  for (const m of [...wb.matchAll(/<sheet\b[^>]*>/g)].slice(0, 8)) {
    const name = unesc(/\bname="([^"]*)"/.exec(m[0])?.[1] || `Sheet ${sheets.length + 1}`);
    const target = rels[/\br:id="([^"]*)"/.exec(m[0])?.[1]];
    const xml = target ? readEntry(buf, entries, target) : "";
    const rows = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      if (rows.length >= 300) break;
      const row = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], body = c[2] || "";
        const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
        const type = /\bt="([^"]*)"/.exec(attrs)?.[1];
        let v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
        if (type === "s") v = shared[Number(v)] ?? "";
        else if (type === "inlineStr") v = unesc([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
        else v = unesc(v);
        const i = ref ? colIndex(ref) : row.length;
        if (i < 40) { while (row.length < i) row.push(""); row[i] = v; }
      }
      rows.push(row);
    }
    sheets.push({ name, rows });
  }
  return { type: "sheet", sheets };
}

/** Preview of an uploaded file as JSON. Images and PDFs are shown from the original file instead. */
function previewOf(buf, ext) {
  try {
    if (ext === "docx") return docx(buf);
    if (ext === "xlsx") return xlsx(buf);
  } catch { /* unreadable: fall through */ }
  return { type: "none" };
}

module.exports = { previewOf };

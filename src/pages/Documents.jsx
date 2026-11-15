import { useState, useEffect, useRef } from "react";
import {
  Lock, ChevronRight, ChevronDown, FileText, Image as ImageIcon, ArrowLeft, CheckCircle2,
  Search, UploadCloud, User, LogOut, GraduationCap, AlertCircle, UserPlus, Pencil, Trash2,
  Plus, Check, X as XIcon, Loader2, Mail, Download, Eye, Folder,
} from "lucide-react";

const C = {
  ink: "#0e3126",
 
  paper: "#F1FAF6",
  panel: "#FFFFFF",
  accent: "#FF6A13",
  accentDim: "#FFE4D2",
  steel: "#3F6B57",
  graphite: "#5B6472",
  line: "#D7E8DE",
  success: "#2E7D32",
  successBg: "#E6F2E7",
  warn: "#8A5A00",
  warnBg: "#FFF1DB",
  danger: "#B3261E",
  dangerBg: "#FBEAE9",
  lock: "#9AA3AF",
};
const display = { fontFamily: "'Big Shoulders Display', sans-serif" };
const body = { fontFamily: "'Manrope', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
* { box-sizing: border-box; }
button, [role="button"] { transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease, transform 0.1s ease; }
button:active { transform: scale(0.98); }
input, select, textarea { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #FF6A13 !important; box-shadow: 0 0 0 3px rgba(255,106,19,0.12); }`;



const COLLEGES = [
  { aliases: ["shri vishnu engineering college for women", "vishnu women's university", "svecw"], code: "SVECW", name: "Shri Vishnu Engineering College for Women" },
  { aliases: ["vishnu institute of technology", "vit b", "vit-b", "vitb", "vits"], code: "VIT B", name: "Vishnu Institute of Technology, Bhimavaram" },
  { aliases: ["b v raju institute of technology hyderabad", "bvrith"], code: "BVRITH", name: "BVRIT Hyderabad College of Engineering for Women" },
  { aliases: ["b v raju institute of technology", "bvrit"], code: "BVRIT", name: "B V Raju Institute of Technology, Narsapur" },
];
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

const MONTH_LABELS = MONTHS.map((m) => m.charAt(0).toUpperCase() + m.slice(1));
const ACAD_YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028", "2029", "2030"]; // one year per record, e.g. 2025
const EVENT_YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028"];
// an uploaded folder is stored as College › Folder › Year; its contents are split into Photos / Design / Reports
const ctxEvent = (c) => (c.folder ? c.folder : null);
const ctxComplete = (c) => !!(c.college && c.year && c.folder);
const pathOf = (o) => [o.college, o.event, o.year];
const THREE = ["photos", "design", "reports"];
const toThree = (cat) => (THREE.includes(cat) ? cat : /design/.test(cat || "") ? "design" : "reports");
const inScope = (f, sc) =>
  (!sc.college || f.college === sc.college) && (!sc.year || f.year === sc.year) && (!sc.event || f.event === sc.event);
const sameEvt = (f, e) =>
  (f.college || "Unassigned") === e.college && (f.year || "No year") === e.year && (f.event || "No folder") === e.event;

const INITIAL_CATEGORIES = [
  { key: "design", label: "Design", minRole: 0, files: [] },
  { key: "design considerations", label: "Design Considerations", minRole: 0, files: [] },
  { key: "challenges faced", label: "Challenges Faced", minRole: 0, files: [] },
  { key: "photos", label: "Photos", minRole: 0, files: [] },
  { key: "reports", label: "Reports", minRole: 0, files: [] },
  { key: "faculty expertise", label: "Faculty Expertise", minRole: 2, files: [] },
  { key: "learning outcomes", label: "Learning Outcomes", minRole: 1, files: [] },
];

const ROLE_RANK = {
  "Student Team Member": 0,
  "External user": 0,
  "Faculty Member": 2,
  "Faculty Coordinator": 2,
  Admin: 2,
};
const ROLE_SCOPE = {
  "Student Team Member": { scope: "Own event folders", access: "View + Add/Edit/Delete" },
  "Faculty Member": { scope: "Assigned events, all colleges", access: "View only" },
  "Faculty Coordinator": { scope: "All events, own college", access: "View + Add/Edit/Delete" },
  "External user": { scope: "Shared events only", access: "View (read-only)" },
  Admin: { scope: "Entire archive, all colleges", access: "Full control" },
};
const ALL_ROLES = Object.keys(ROLE_SCOPE);
const CAN_MODIFY_ROLES = ["Faculty Coordinator", "Student Team Member", "Admin"];

const SEED_USERS = [
  { id: "admin@svecw.edu.in", password: "admin123", role: "Admin", name: "System Administrator", status: "approved" },
 
];


const ALLOWED_DOMAINS = ["svecw.edu.in", "vitb.edu.in", "bvrith.edu.in"];
function isAllowedDomain(email) {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return ALLOWED_DOMAINS.includes(domain);
}

const EXAMPLES = {
  retrieve1: `Show me the photos from the folder BAJA 2025 at SVECW.`,
  retrieve2: `Get the design files of the folder BAJA 2025 at SVECW, 2024-25.`,
};


function parsePrompt(text, categories, forcedIntent, folders = []) {
  const lower = text.toLowerCase();
  const norm = (x) => x.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  const nlower = norm(text);
  let folder = [...folders].sort((a, b) => b.length - a.length).find((f) => f && nlower.includes(norm(f))) || null;

  let college = null;
  for (const c of COLLEGES) if (c.aliases.some((a) => lower.includes(a))) { college = c; break; }

  let year = null;
  const yearMatch = (folder ? nlower.replace(norm(folder), " ") : nlower).match(/(?:^|[^0-9])(20[2-3]\d)(?![0-9])/);
  if (yearMatch) year = yearMatch[1];

  let month = null, eventYear = null;
  for (const m of MONTHS) {
    const mm = text.match(new RegExp(m + "\\s+(20\\d{2})", "i"));
    if (mm) { month = m.charAt(0).toUpperCase() + m.slice(1); eventYear = mm[1]; break; }
  }

  const matchedCategory = categories.find((c) => lower.includes(c.key.split(" ")[0]));

  let contributor = null;
  const creditMatch = text.match(/(?:credit|coordinator|requested by)\s*:?\s*([A-Za-z.\s]+?)(?:,|\.|$)/i);
  if (creditMatch) contributor = creditMatch[1].trim();


  const intent = forcedIntent || "retrieve";

  // leftover meaningful words (e.g. "chassis", "suspension") narrow the files shown
  const STOP = new Set("the a an of for to in on at and or with from by me my us we our i is are was were be show give get fetch find open need want see view display retrieve please all any some files file folder data details detail document documents event events baja college year month photos photo pictures images image reports report design designs credit credits coordinator requested about related regarding that this those these what which who how".split(" "));
  const used = new Set();
  categories.forEach((c) => c.key.split(" ").forEach((w) => used.add(w)));
  COLLEGES.forEach((c) => c.aliases.forEach((a) => a.split(/\s+/).forEach((w) => used.add(w))));
  MONTHS.forEach((m) => used.add(m));
  if (folder) norm(folder).split(" ").forEach((w) => used.add(w));
  if (contributor) contributor.toLowerCase().split(/\s+/).forEach((w) => used.add(w));
  let keywords = (lower.match(/[a-z][a-z0-9_-]{2,}/g) || []).filter((w) => !STOP.has(w) && !used.has(w));
  // folder named loosely (e.g. "abaja" or "baja" for BVRIT_abaja_2025): accept it when exactly one stored folder fits
  if (!folder) {
    const hits = folders.filter((f) => { const nf = norm(f); return keywords.some((k) => k.length >= 4 && (nf.split(" ").includes(k) || nf.includes(k))); });
    if (hits.length === 1) { folder = hits[0]; const fw = norm(folder); keywords = keywords.filter((k) => !fw.includes(k)); }
  }

  return { college, year, month, eventYear, folder, category: matchedCategory, contributor, intent, keywords };
}



function Panel({ children, style }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, position: "relative", padding: 24, boxShadow: "0 1px 2px rgba(15,27,41,0.04)", animation: "fadeInUp 0.35s ease", ...style }}>
      <span style={{ position: "absolute", top: -1, left: -1, width: 10, height: 10, borderTop: `2px solid ${C.steel}`, borderLeft: `2px solid ${C.steel}`, opacity: 0.45 }} />
      <span style={{ position: "absolute", top: -1, right: -1, width: 10, height: 10, borderTop: `2px solid ${C.steel}`, borderRight: `2px solid ${C.steel}`, opacity: 0.45 }} />
      <span style={{ position: "absolute", bottom: -1, left: -1, width: 10, height: 10, borderBottom: `2px solid ${C.steel}`, borderLeft: `2px solid ${C.steel}`, opacity: 0.45 }} />
      <span style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderBottom: `2px solid ${C.steel}`, borderRight: `2px solid ${C.steel}`, opacity: 0.45 }} />
      {children}
    </div>
  );
}
function FieldLabel({ children }) {
  return <div style={{ ...mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: C.steel, marginBottom: 8 }}>{children}</div>;
}
function ExtractItem({ label, value }) {
  const filled = value && value !== "—";
  return (
    <div style={{ border: `1px solid ${filled ? C.accent : C.line}`, background: C.paper, padding: "10px 12px", minHeight: 52 }}>
      <div style={{ ...mono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: C.lock }}>{label}</div>
      <div style={{ ...display, fontWeight: 700, fontSize: 15, marginTop: 3, color: C.ink }}>{value || "—"}</div>
    </div>
  );
}
function inputStyle() {
  return { width: "100%", border: `1px solid ${C.line}`, background: "#fff", padding: "11px 12px", ...body, fontSize: 13.5, color: C.ink };
}
// Auto-recognise which folder an uploaded file belongs in, from its type and name.
const CAD_EXT = ["dwg","dxf","step","stp","stl","iges","igs","sldprt","sldasm","f3d","prt","cad","skp"];
const IMG_EXT = ["jpg","jpeg","png","gif","webp","bmp","heic","svg","tif","tiff"];
const DOC_EXT = ["pdf","doc","docx","txt","md","odt","rtf","xls","xlsx","csv","ppt","pptx"];
// keyword evidence per category (checked against file name and, for readable files, the content)
const CAT_WORDS = {
  "learning outcomes": ["learning outcome", "outcome", "learning", "reflection", "takeaway", "lesson", "skills gained", "what we learned", "learned"],
  "faculty expertise": ["faculty expertise", "mentor", "faculty", "expertise", "guidance", "advisor", "supervis", "feedback from"],
  "challenges faced": ["challenge", "failure", "problem", "issue", "breakdown", "troubleshoot", "difficult", "obstacle", "setback", "root cause"],
  "design considerations": ["design consideration", "consideration", "trade-off", "tradeoff", "constraint", "assumption", "rationale", "design decision", "safety factor", "why we chose", "selection criteria"],
  "design": ["chassis", "suspension", "cad", "drawing", "blueprint", "schematic", "layout", "assembly", "geometry", "cad model", "frame design", "steering", "drivetrain", "roll cage", "fea ", "simulation"],
  "reports": ["report", "summary", "analysis", "results", "test", "abstract", "conclusion", "cost report", "technical report", "presentation", "minutes"],
};
function scoreText(text, weight) {
  const t = (text || "").toLowerCase();
  const out = {};
  for (const [cat, words] of Object.entries(CAT_WORDS)) {
    let n = 0;
    for (const w of words) { const hits = t.split(w).length - 1; if (hits) n += Math.min(hits, 5) * (w.includes(" ") ? 2 : 1); }
    if (n) out[cat] = n * weight;
  }
  return out;
}
// quick synchronous guess from name + type only
function classifyFile(file) {
  const name = (file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  const type = file.type || "";
  const sc = scoreText(name.replace(/[_\-.]+/g, " "), 4);
  const best = Object.entries(sc).sort((x, y) => y[1] - x[1])[0];
  if (best && best[0] !== "reports") return best[0];
  if (CAD_EXT.includes(ext)) return "design";
  if (type.startsWith("image/") || IMG_EXT.includes(ext)) return "photos";
  if (best) return best[0];
  if (DOC_EXT.includes(ext)) return "reports";
  return "";
}
async function inflateRaw(u8) {
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter(); w.write(u8); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
// pulls readable text out of .txt/.md/.csv and out of .docx/.pptx (zip of XML)
async function readFileText(file) {
  const ext = (file.name || "").toLowerCase().split(".").pop();
  try {
    if (["txt", "md", "csv", "json", "rtf"].includes(ext) || (file.type || "").startsWith("text/")) return (await file.slice(0, 40000).text());
    if (["docx", "pptx"].includes(ext)) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const dv = new DataView(buf.buffer);
      let out = "";
      for (let i = 0; i < buf.length - 30 && out.length < 40000;) {
        if (dv.getUint32(i, true) !== 0x04034b50) { i++; continue; }
        const method = dv.getUint16(i + 8, true), csize = dv.getUint32(i + 18, true);
        const nlen = dv.getUint16(i + 26, true), xlen = dv.getUint16(i + 28, true);
        const fname = new TextDecoder().decode(buf.slice(i + 30, i + 30 + nlen));
        const start = i + 30 + nlen + xlen;
        if (csize && /^(word\/document\.xml|ppt\/slides\/slide\d+\.xml)$/.test(fname)) {
          const raw = buf.slice(start, start + csize);
          const xml = new TextDecoder().decode(method === 8 ? await inflateRaw(raw) : raw);
          out += (fname.startsWith("ppt/") ? "\n\n— slide —\n" : "\n") + xml.replace(/<\/(?:w|a):p>|<w:br\/>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'");
        }
        i = start + (csize || 1);
      }
      return out;
    }
  } catch (e) { /* unreadable — fall back to the name */ }
  return "";
}
// work out College / Academic year / Month / Event year from a file's name and readable content
function detectContext(file, text) {
  const out = {}, how = {};
  const nameT = (file.name || "").toLowerCase().replace(/[_.]+/g, " ");
  const sources = [["name", nameT], ["content", (text || "").toLowerCase()]];
  const esc = (a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const [src, t0] of sources) {
    let t = t0;
    if (!t) continue;
    if (!out.college) for (const c of COLLEGES) {
      const al = [...c.aliases, c.code.toLowerCase()].sort((a, b) => b.length - a.length);
      if (al.some((a) => new RegExp(`(^|[^a-z0-9])${esc(a).replace(/\s+/g, "\\s+")}($|[^a-z0-9])`).test(t))) { out.college = c.code; how.college = src; break; }
    }
    if (!out.year) {
      const m = t.match(/(20\d{2})\s*(?:-|–|to|\/)\s*(?:20)?(\d{2})\b/);
      if (m) { if (ACAD_YEARS.includes(m[1])) { out.year = m[1]; how.year = src; } t = t.replace(m[0], " "); }
    }
    if (!out.month) {
      const i = MONTHS.findIndex((mn) => new RegExp(`(^|[^a-z])(${mn}${mn.length > 3 ? "|" + mn.slice(0, 3) : ""})($|[^a-z])`).test(t));
      if (i >= 0) { out.month = MONTH_LABELS[i]; how.month = src; }
    }
    if (!out.eventYear) {
      const ys = (t.match(/(?:^|[^0-9])(20[2-3]\d)(?![0-9])/g) || []).map((x) => x.replace(/\D/g, "")).filter((y) => EVENT_YEARS.includes(y));
      if (ys.length) { out.eventYear = ys[0]; how.eventYear = src; }
    }
  }
  // fall back to the file's own date for whatever is still unknown
  const d = file.lastModified ? new Date(file.lastModified) : null;
  if (d) {
    if (!out.month) { out.month = MONTH_LABELS[d.getMonth()]; how.month = "file date"; }
    if (!out.eventYear && EVENT_YEARS.includes(String(d.getFullYear()))) { out.eventYear = String(d.getFullYear()); how.eventYear = "file date"; }
  }
  if (!out.year && out.eventYear && ACAD_YEARS.includes(out.eventYear)) { out.year = out.eventYear; how.year = how.eventYear; }
  return { ctx: out, how };
}

// name + content evidence -> { cat, conf: "high" | "low" | "none" }
async function classifyDeep(file) {
  const name = (file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  const sc = scoreText(name.replace(/[_\-.]+/g, " "), 4);
  const text = await readFileText(file);
  if (text) { const c = scoreText(text, 1); for (const k in c) sc[k] = (sc[k] || 0) + c[k]; }
  const ranked = Object.entries(sc).sort((x, y) => y[1] - x[1]);
  const isCad = CAD_EXT.includes(ext);
  const isImg = (file.type || "").startsWith("image/") || IMG_EXT.includes(ext);
  const det = detectContext(file, text);
  const res = (cat, conf) => ({ cat, conf, det });
  if (isCad) return res("design", "high");
  const specific = ranked.filter(([k]) => k !== "reports");
  if (specific.length && specific[0][1] >= 4) return res(specific[0][0], "high");
  if (isImg) return res("photos", "high");
  if (ranked.length) return res(ranked[0][0], ranked[0][1] >= 4 ? "high" : "low");
  if (DOC_EXT.includes(ext)) return res("reports", "high");
  return res("", "none");
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function IconBtn({ onClick, title, tone = C.steel, children }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
      border: `1px solid ${C.line}`, background: "#fff", color: tone, cursor: "pointer", flexShrink: 0,
    }}>
      {children}
    </button>
  );
}
function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, background: C.ink, color: "#fff",
      padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, fontSize: 13,
      ...body, zIndex: 50, border: `1px solid ${C.accent}`, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    }}>
      <CheckCircle2 size={16} style={{ color: C.accent }} /> {message}
    </div>
  );
}
function GoogleMark() {
  return (
    <span style={{
      width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${C.graphite}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700, color: C.graphite, flexShrink: 0, ...display,
    }}>G</span>
  );
}
function initialsOf(name) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
const AVATAR_COLORS = ["#3E5C76", "#B84A0E", "#2E7D32", "#6A4C93", "#8A5A00"];

function GoogleChooserModal({ users, defaultRole, onPick, onClose }) {
  const [loadingEmail, setLoadingEmail] = useState(null);
  const [showOther, setShowOther] = useState(false);
  const [otherEmail, setOtherEmail] = useState("");
  const [verifyAcc, setVerifyAcc] = useState(null); 
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyError, setVerifyError] = useState("");

  function pick(acc) {
    setLoadingEmail(acc.email);
    setTimeout(() => onPick(acc), 700);
  }

  function openVerify(acc) {
    setVerifyAcc(acc);
    setVerifyPassword("");
    setVerifyError("");
  }

  function submitVerify(e) {
    e.preventDefault();
    if (verifyPassword !== verifyAcc.password) { setVerifyError("Incorrect password. Try again."); return; }
    setVerifyError("");
    pick({ name: verifyAcc.name, email: verifyAcc.id, role: verifyAcc.role });
  }

  function pickOther(e) {
    e.preventDefault();
    if (!otherEmail.trim()) return;
    const name = otherEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    pick({ name, email: otherEmail.trim(), role: defaultRole, isNew: true });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,41,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding: "24px 24px 16px 24px", textAlign: "center", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${C.graphite}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: C.graphite, ...display }}>G</span>
          </div>
          <div style={{ ...body, fontSize: 16, fontWeight: 700, color: C.ink }}>Sign in with Google</div>
          <div style={{ ...body, fontSize: 12.5, color: C.graphite, marginTop: 4 }}>{verifyAcc ? "Confirm it's you" : "Choose an SVES Connect account"}</div>
        </div>

        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {verifyAcc ? (
            <form onSubmit={submitVerify} style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: C.steel, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0, ...display }}>
                  {initialsOf(verifyAcc.name)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...body, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{verifyAcc.name}</div>
                  <div style={{ ...body, fontSize: 11.5, color: C.graphite, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{verifyAcc.id}</div>
                </div>
              </div>

              <FieldLabel>Password</FieldLabel>
              <input autoFocus type="password" value={verifyPassword} onChange={(e) => setVerifyPassword(e.target.value)} placeholder="••••••••" style={{ ...inputStyle(), marginBottom: 8 }} />

              {verifyError && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.dangerBg, color: C.danger, padding: "8px 10px", fontSize: 12, marginBottom: 12, ...body }}>
                  <AlertCircle size={13} style={{ flexShrink: 0 }} /> {verifyError}
                </div>
              )}

              <button type="submit" disabled={!!loadingEmail} style={{ width: "100%", ...display, fontWeight: 700, fontSize: 13.5, background: C.accent, color: "#fff", border: "none", padding: "11px 20px", cursor: loadingEmail ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
                {loadingEmail ? <><Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> Verifying…</> : <>Verify & sign in</>}
              </button>
              <div onClick={() => !loadingEmail && setVerifyAcc(null)} style={{ textAlign: "center", fontSize: 12, color: C.steel, fontWeight: 600, cursor: loadingEmail ? "default" : "pointer" }}>
                ← Choose a different account
              </div>
            </form>
          ) : !showOther ? (
            <>
              {users.length === 0 && (
                <div style={{ padding: "18px 24px", fontSize: 12.5, color: C.graphite, ...body }}>No accounts registered yet — add one below.</div>
              )}
              {users.map((acc, i) => (
                <div key={acc.id} onClick={() => openVerify(acc)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 24px",
                  cursor: "pointer", borderBottom: `1px solid ${C.line}`,
                }}>
                  <span style={{ width: 36, height: 36, borderRadius: "50%", background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0, ...display }}>
                    {initialsOf(acc.name)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...body, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{acc.name}</div>
                    <div style={{ ...body, fontSize: 11.5, color: C.graphite, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.id}</div>
                  </div>
                  <span style={{ ...mono, fontSize: 9.5, color: C.lock, border: `1px solid ${C.line}`, padding: "2px 6px", flexShrink: 0 }}>{acc.role}</span>
                </div>
              ))}
              <div onClick={() => setShowOther(true)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", cursor: "pointer" }}>
                <span style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <User size={16} style={{ color: C.graphite }} />
                </span>
                <div style={{ ...body, fontSize: 13.5, fontWeight: 600, color: C.ink }}>Add a new Google account</div>
              </div>
            </>
          ) : (
            <form onSubmit={pickOther} style={{ padding: "18px 24px" }}>
              <FieldLabel>Email address</FieldLabel>
              <input autoFocus value={otherEmail} onChange={(e) => setOtherEmail(e.target.value)} placeholder="you@gmail.com" style={{ ...inputStyle(), marginBottom: 6 }} />
              <div style={{ fontSize: 11.5, color: C.graphite, marginBottom: 14, ...body }}>New to SVES Connect — this will register as <strong>{defaultRole}</strong> and go to Admin for approval.</div>
              <button type="submit" disabled={!!loadingEmail} style={{ width: "100%", ...display, fontWeight: 700, fontSize: 13.5, background: C.accent, color: "#fff", border: "none", padding: "11px 20px", cursor: loadingEmail ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loadingEmail ? <><Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> Submitting…</> : <>Next</>}
              </button>
            </form>
          )}
        </div>

        <div style={{ padding: "12px 24px", borderTop: `1px solid ${C.line}`, textAlign: "right" }}>
          <span onClick={onClose} style={{ ...body, fontSize: 12.5, color: C.steel, fontWeight: 600, cursor: "pointer" }}>Cancel</span>
        </div>
      </div>
    </div>
  );
}


function LoginPage({ users, onRegister, onLoginSuccess }) {
  const [mode, setMode] = useState("signin");
  const [audience, setAudience] = useState("Student Team Member");

  const [idInput, setIdInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  const [nameInput, setNameInput] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState("Student Team Member");

  const [error, setError] = useState("");
  const [googleOpen, setGoogleOpen] = useState(false);
  const [pendingNotice, setPendingNotice] = useState(null); 

  function attemptSignIn(e) {
    e.preventDefault();
    const email = idInput.trim().toLowerCase();
    if (!email || !passwordInput.trim()) { setError("Please enter valid credentials."); return; }
    const match = users.find((u) => u.id.toLowerCase() === email && u.password === passwordInput);
    if (!match) { setError("Please enter valid credentials. Check your email and password, or sign up if you're new."); return; }
    if (match.status !== "approved") { setError("This account is still awaiting admin approval. You'll be able to sign in once it's approved."); return; }
    setError("");
    onLoginSuccess(match);
  }

  function attemptSignUp(e) {
    e.preventDefault();
    const email = signupEmail.trim().toLowerCase();
    if (!nameInput.trim() || !email || !signupPassword.trim()) { setError("Fill in your name, email and password to create an account."); return; }
    if (!isAllowedDomain(email)) { setError(`Please use your official college email (e.g. name@${ALLOWED_DOMAINS[0]}).`); return; }
    if (users.some((u) => u.id.toLowerCase() === email)) { setError("An account with this email already exists. Try signing in instead."); return; }
    const newUser = { id: email, password: signupPassword, role: signupRole, name: nameInput.trim(), status: "pending" };
    setError("");
    onRegister(newUser);
    setPendingNotice({ email });
  }

  function handleGooglePick(acc) {
    const existing = users.find((u) => u.id.toLowerCase() === acc.email.toLowerCase());
    if (existing) {
      setGoogleOpen(false);
      if (existing.status !== "approved") { setError("This account is still awaiting admin approval."); return; }
      onLoginSuccess(existing);
      return;
    }
    if (!isAllowedDomain(acc.email)) {
      setGoogleOpen(false);
      setError(`Google sign-in is only available for official college addresses (e.g. name@${ALLOWED_DOMAINS[0]}).`);
      return;
    }
    const newUser = { id: acc.email, password: "__google__", role: acc.role, name: acc.name, status: "pending" };
    onRegister(newUser);
    setGoogleOpen(false);
    setPendingNotice({ email: acc.email });
  }

  return (
    <div style={{
      ...body, minHeight: "100vh", background: C.ink, color: "#fff",
      backgroundImage: `linear-gradient(${C.inkLine} 1px, transparent 1px), linear-gradient(90deg, ${C.inkLine} 1px, transparent 1px)`,
      backgroundSize: "28px 28px",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <style>{FONT_IMPORT}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 26 }}>
          <div style={{ width: 38, height: 38, border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", ...display, fontWeight: 800, fontSize: 15, color: C.accent }}>SC</div>
          <div>
            <div style={{ ...display, fontWeight: 700, fontSize: 20, letterSpacing: "0.01em" }}>SVES CONNECT</div>
            <div style={{ fontSize: 11, color: "#A9CBB9", ...mono }}>BAJA Content Publication Module</div>
          </div>
        </div>

        <div style={{ background: "#fff", color: C.ink, padding: 28, position: "relative", boxShadow: "0 24px 60px rgba(0,0,0,0.25)", animation: "popIn 0.35s ease" }}>
          <span style={{ position: "absolute", top: -1, left: -1, width: 12, height: 12, borderTop: `2px solid ${C.accent}`, borderLeft: `2px solid ${C.accent}` }} />
          <span style={{ position: "absolute", bottom: -1, right: -1, width: 12, height: 12, borderBottom: `2px solid ${C.accent}`, borderRight: `2px solid ${C.accent}` }} />

          {pendingNotice ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <span style={{ width: 48, height: 48, borderRadius: "50%", background: C.successBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 size={24} style={{ color: C.success }} />
                </span>
              </div>
              <h1 style={{ ...display, fontSize: 22, fontWeight: 700, margin: "0 0 8px 0" }}>Request submitted</h1>
              <p style={{ color: C.graphite, fontSize: 13, lineHeight: 1.6, margin: "0 0 20px 0" }}>
                <strong>{pendingNotice.email}</strong> has been created but isn't active yet. An Admin needs to approve it before you can sign in — that's the "authorised access only" part working as intended.
              </p>
              <button
                onClick={() => { setPendingNotice(null); setMode("signin"); setError(""); }}
                style={{ ...display, fontWeight: 700, fontSize: 14, background: C.ink, color: "#fff", border: "none", padding: "11px 22px", cursor: "pointer" }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
          <h1 style={{ ...display, fontSize: 26, fontWeight: 700, margin: "0 0 4px 0" }}>{mode === "signin" ? "Sign in" : "Create your account"}</h1>
          <p style={{ color: C.graphite, fontSize: 13, margin: "0 0 20px 0" }}>Authorised access only — students, faculty mentors, coordinators, reviewers and admins each see a different slice of the archive.</p>

          <div style={{ display: "flex", gap: 18, marginBottom: 18, borderBottom: `1px solid ${C.line}` }}>
            {[["signin", "Sign in"], ["signup", "Sign up"]].map(([key, label]) => (
              <div key={key} onClick={() => { setMode(key); setError(""); }} style={{
                padding: "0 0 10px 0", cursor: "pointer", fontSize: 14, ...display, fontWeight: 700,
                color: mode === key ? C.ink : C.lock,
                borderBottom: `2px solid ${mode === key ? C.accent : "transparent"}`,
              }}>{label}</div>
            ))}
          </div>

          {mode === "signin" ? (
            <>
              <div style={{ display: "flex", border: `1px solid ${C.line}`, marginBottom: 18 }}>
                {["Student Team Member", "Faculty Mentor"].map((r) => (
                  <div key={r} onClick={() => setAudience(r)} style={{
                    flex: 1, textAlign: "center", padding: "10px 8px", cursor: "pointer", fontSize: 13, ...display, fontWeight: 700,
                    background: audience === r ? C.ink : "#fff", color: audience === r ? "#fff" : C.graphite,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
                    {r === "Student Team Member" ? <User size={14} /> : <GraduationCap size={14} />}
                    {r === "Student Team Member" ? "Student" : "Faculty"}
                  </div>
                ))}
              </div>

              <form onSubmit={attemptSignIn}>
                <FieldLabel>College email</FieldLabel>
                <input value={idInput} onChange={(e) => setIdInput(e.target.value)} placeholder={audience === "Student Team Member" ? "you@svecw.edu.in" : "you.faculty@svecw.edu.in"} style={{ ...inputStyle(), marginBottom: 14 }} />

                <FieldLabel>Password</FieldLabel>
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="••••••••" style={{ ...inputStyle(), marginBottom: 16 }} />

                {error && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.dangerBg, color: C.danger, padding: "9px 12px", fontSize: 12.5, marginBottom: 14, ...body }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
                  </div>
                )}

                <button type="submit" style={{ width: "100%", ...display, fontWeight: 700, fontSize: 15, background: C.accent, color: "#fff", border: "none", padding: "12px 20px", cursor: "pointer" }}>
                  Sign in as {audience === "Student Team Member" ? "Student" : "Faculty"}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={attemptSignUp}>
              <FieldLabel>Full name</FieldLabel>
              <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Your name" style={{ ...inputStyle(), marginBottom: 14 }} />

              <FieldLabel>College email</FieldLabel>
              <input value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} placeholder="you@svecw.edu.in" style={{ ...inputStyle(), marginBottom: 14 }} />

              <FieldLabel>Password</FieldLabel>
              <input type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} placeholder="••••••••" style={{ ...inputStyle(), marginBottom: 14 }} />

              <FieldLabel>I am a</FieldLabel>
              <select value={signupRole} onChange={(e) => setSignupRole(e.target.value)} style={{ ...inputStyle(), marginBottom: 16, cursor: "pointer" }}>
                {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>

              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.dangerBg, color: C.danger, padding: "9px 12px", fontSize: 12.5, marginBottom: 14, ...body }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
                </div>
              )}

              <button type="submit" style={{ width: "100%", ...display, fontWeight: 700, fontSize: 15, background: C.accent, color: "#fff", border: "none", padding: "12px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <UserPlus size={15} /> Create account
              </button>
            </form>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: C.line }} />
            <span style={{ fontSize: 11, color: C.lock, ...mono }}>OR</span>
            <div style={{ flex: 1, height: 1, background: C.line }} />
          </div>

          <button type="button" onClick={() => setGoogleOpen(true)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: "#fff", color: C.ink, border: `1px solid ${C.line}`, padding: "11px 20px",
            cursor: "pointer", fontSize: 14, ...display, fontWeight: 700,
          }}>
            <GoogleMark /> Continue with Google
          </button>

          {googleOpen && (
            <GoogleChooserModal
              users={users}
              defaultRole={mode === "signup" ? signupRole : audience}
              onPick={handleGooglePick}
              onClose={() => setGoogleOpen(false)}
            />
          )}

          <p style={{ textAlign: "center", fontSize: 12, color: C.graphite, marginTop: 16, marginBottom: 0, ...body }}>
            {mode === "signin" ? (
              <>New here? <span onClick={() => { setMode("signup"); setError(""); }} style={{ color: C.accent, fontWeight: 700, cursor: "pointer" }}>Create an account</span></>
            ) : (
              <>Already have an account? <span onClick={() => { setMode("signin"); setError(""); }} style={{ color: C.accent, fontWeight: 700, cursor: "pointer" }}>Sign in</span></>
            )}
          </p>
            </>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 11, color: "#7FA694", ...mono }}>
         
        </div>
      </div>
    </div>
  );
}

function FileRow({ file, editable, onView, onDownload, isEditing, editDraft, onStartEdit, onChangeDraft, onSave, onCancel, onDelete, isConfirmingDelete, onConfirmDelete, onCancelDelete }) {
  if (isEditing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", border: `1px solid ${C.accent}`, marginBottom: 8, background: "#fff" }}>
        <FileText size={18} style={{ color: C.steel, flexShrink: 0 }} />
        <input value={editDraft.name} onChange={(e) => onChangeDraft({ ...editDraft, name: e.target.value })} style={{ flex: 1, border: `1px solid ${C.line}`, padding: "6px 8px", fontSize: 13, ...body }} />
        <input value={editDraft.meta} onChange={(e) => onChangeDraft({ ...editDraft, meta: e.target.value })} placeholder="meta / size" style={{ width: 140, border: `1px solid ${C.line}`, padding: "6px 8px", fontSize: 12, ...mono }} />
        <IconBtn onClick={onSave} title="Save" tone={C.success}><Check size={14} /></IconBtn>
        <IconBtn onClick={onCancel} title="Cancel" tone={C.graphite}><XIcon size={14} /></IconBtn>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${C.line}`, marginBottom: 8, background: C.paper }}>
      <FileText size={18} style={{ color: C.steel, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, ...body }}>{file.name}</div>
        <div style={{ fontSize: 11, color: C.graphite, ...mono }}>{file.meta}</div>
      </div>
      {!isConfirmingDelete && (
        <div style={{ display: "flex", gap: 6 }}>
          <IconBtn onClick={() => onView(file)} title="View" tone={C.steel}><Eye size={13} /></IconBtn>
          <IconBtn onClick={() => onDownload(file)} title="Download" tone={C.steel}><Download size={13} /></IconBtn>
          {editable && (
            <>
              <IconBtn onClick={onStartEdit} title="Edit"><Pencil size={13} /></IconBtn>
              <IconBtn onClick={onDelete} title="Delete" tone={C.danger}><Trash2 size={13} /></IconBtn>
            </>
          )}
        </div>
      )}
      {isConfirmingDelete && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: C.danger, ...mono }}>Delete?</span>
          <IconBtn onClick={onConfirmDelete} title="Confirm delete" tone={C.danger}><Check size={13} /></IconBtn>
          <IconBtn onClick={onCancelDelete} title="Cancel"><XIcon size={13} /></IconBtn>
        </div>
      )}
    </div>
  );
}

function PhotoTile({ file, editable, onView, onDownload, isEditing, editDraft, onStartEdit, onChangeDraft, onSave, onCancel, onDelete, isConfirmingDelete, onConfirmDelete, onCancelDelete }) {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (file.file && file.file.type && file.file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file.file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file.file]);

  return (
    <div style={{
      position: "relative", aspectRatio: "4/3", overflow: "hidden",
      background: previewUrl ? "#000" : "repeating-linear-gradient(135deg,#EDEFF2,#EDEFF2 8px,#E4E7EC 8px,#E4E7EC 16px)",
      border: `1px solid ${isEditing ? C.accent : C.line}`, display: "flex", alignItems: "center", justifyContent: "center",
      ...mono, fontSize: 10.5, color: C.lock, padding: previewUrl ? 0 : 6, textAlign: "center",
    }}>
      {isEditing ? (
        <div style={{ background: "#fff", padding: 6, width: "100%", display: "flex", flexDirection: "column", gap: 4, position: "relative", zIndex: 1 }}>
          <input value={editDraft.name} onChange={(e) => onChangeDraft({ ...editDraft, name: e.target.value })} style={{ border: `1px solid ${C.line}`, padding: "4px 6px", fontSize: 10.5, ...mono }} />
          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
            <IconBtn onClick={onSave} title="Save" tone={C.success}><Check size={12} /></IconBtn>
            <IconBtn onClick={onCancel} title="Cancel"><XIcon size={12} /></IconBtn>
          </div>
        </div>
      ) : (
        <>
          {previewUrl ? (
            <>
              <img src={previewUrl} alt={file.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "4px 6px", background: "linear-gradient(transparent, rgba(0,0,0,0.65))", textAlign: "left" }}>
                <span style={{ color: "#fff", fontSize: 10, ...mono }}>{file.name}</span>
              </div>
            </>
          ) : (
            <span><ImageIcon size={13} style={{ marginRight: 4, opacity: 0.5, verticalAlign: "-2px" }} />{file.name}</span>
          )}
          {!isConfirmingDelete && (
            <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 3 }}>
              <IconBtn onClick={() => onView(file)} title="View" tone={C.steel}><Eye size={11} /></IconBtn>
              <IconBtn onClick={() => onDownload(file)} title="Download" tone={C.steel}><Download size={11} /></IconBtn>
              {editable && (
                <>
                  <IconBtn onClick={onStartEdit} title="Edit"><Pencil size={11} /></IconBtn>
                  <IconBtn onClick={onDelete} title="Delete" tone={C.danger}><Trash2 size={11} /></IconBtn>
                </>
              )}
            </div>
          )}
          {isConfirmingDelete && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ color: C.danger, fontSize: 11 }}>Delete?</span>
              <div style={{ display: "flex", gap: 6 }}>
                <IconBtn onClick={onConfirmDelete} title="Confirm" tone={C.danger}><Check size={12} /></IconBtn>
                <IconBtn onClick={onCancelDelete} title="Cancel"><XIcon size={12} /></IconBtn>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- persistence (IndexedDB keeps real File objects across closing / reopening) ----
const DB_NAME = "sves-baja", STORE = "kv";
function idbOpen() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") { rej(new Error("IndexedDB not available")); return; }
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("blocked"));
  });
}
// returns { ok, value } so a failed read is never mistaken for "nothing saved"
async function idbGet(key) {
  try {
    const db = await idbOpen();
    const value = await new Promise((res, rej) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    db.close();
    return { ok: true, value };
  } catch (e) { return { ok: false, value: undefined }; }
}
// returns true only when the browser confirms the write is committed
async function idbSet(key, value) {
  try {
    const db = await idbOpen();
    await new Promise((res, rej) => {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).put(value, key);
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error("aborted"));
    });
    db.close();
    return true;
  } catch (e) { return (e && e.name) || "Error"; }
}
const toB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
const fromB64 = (b64, name, type) => { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new File([u8], name, { type: type || "application/octet-stream" }); };

function fileKind(name, type) {
  const ext = (name || "").toLowerCase().split(".").pop();
  if (["dwg","dxf","step","stp","stl","iges","igs","sldprt","sldasm","f3d","prt","cad","skp"].includes(ext)) return "cad";
  if ((type || "").startsWith("image/") || ["jpg","jpeg","png","gif","webp","bmp","heic","svg","tif","tiff"].includes(ext)) return "image";
  if (["dwg","dxf","step","stp","stl","iges","igs","sldprt","sldasm","f3d","prt","cad","skp"].includes(ext)) return "cad";
  if (["pdf","doc","docx","txt","odt","rtf","xls","xlsx","csv","ppt","pptx"].includes(ext)) return "doc";
  return "other";
}
function timeAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString();
}

export default function Documents() {
  const [users, setUsers] = useState(SEED_USERS);
  const [currentUser, setCurrentUser] = useState(null);

  const [step, setStep] = useState("landing"); 
  const [uploadMode, setUploadMode] = useState(false); 
  const [promptText, setPromptText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [focusKey, setFocusKey] = useState(null);

  const [categories, setCategories] = useState(() => INITIAL_CATEGORIES.map((c) => ({ ...c, files: [...c.files] })));

  const [editingFile, setEditingFile] = useState(null); // {catKey, index}
  const [editDraft, setEditDraft] = useState({ name: "", meta: "" });
  const [confirmingDelete, setConfirmingDelete] = useState(null); // {catKey, index}
  const [confirmingCategoryDelete, setConfirmingCategoryDelete] = useState(null); // catKey
  const [addingTo, setAddingTo] = useState(null); // catKey
  const [pickedFiles, setPickedFiles] = useState([]); 
  const fileInputRef = useRef(null);

  const [toast, setToast] = useState("");
  const [showApprovals, setShowApprovals] = useState(false);
  const [smartFiles, setSmartFiles] = useState([]); // [{ file, cat }]
  const smartInputRef = useRef(null);
  const [activity, setActivity] = useState([]);
  const [showActivity, setShowActivity] = useState(false);
  const [preview, setPreview] = useState(null); // { name, kind: "image" | "pdf" | "text" | "none", url, text, note }
  const [searchQ, setSearchQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | failed
  const [canSave, setCanSave] = useState(true);        // false if the saved data could not be read — never overwrite it blindly
  const [persistent, setPersistent] = useState(null);
  const [saveErr, setSaveErr] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const latestRef = useRef(null);
  const backupInputRef = useRef(null);
  const [uploadCtx, setUploadCtx] = useState({ college: "", year: "", folder: "" });
  const [focusEvt, setFocusEvt] = useState(null); // {college, year, event} chosen in the retrieval hierarchy

  // load saved users, files and activity once
  useEffect(() => {
    let alive = true;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((p) => alive && setPersistent(p)); } catch (e) { /* ignore */ }
    idbGet("state").then(({ ok, value: saved }) => {
      if (!alive) return;
      if (!ok) { setCanSave(false); setSaveState("failed"); }
      if (saved) {
        if (Array.isArray(saved.users)) {
          const ids = new Set(saved.users.map((u) => u.id));
          setUsers([...saved.users, ...SEED_USERS.filter((u) => !ids.has(u.id))]);
        }
        if (Array.isArray(saved.categories)) {
          setCategories((prev) => prev.map((c) => {
            const m = saved.categories.find((x) => x.key === c.key);
            return m ? { ...c, files: (m.files || []).map((f) => { const g = f.college === "VITS" ? { ...f, college: "VIT B" } : f; const ym = /^(20\d{2})-\d{2}$/.exec(g.year || ""); return ym ? { ...g, year: ym[1] } : g; }) } : c;
          }));
        }
        if (Array.isArray(saved.activity)) setActivity(saved.activity);
      }
      setHydrated(true);
    });
    return () => { alive = false; };
  }, []);
  // save on every change (after the first load), and once more when the tab is hidden or closed
  useEffect(() => {
    if (!hydrated || !canSave) return;
    const snap = { users, categories, activity };
    latestRef.current = snap;
    setSaveState("saving");
    let alive = true;
    idbSet("state", snap).then((r) => { if (alive) { setSaveState(r === true ? "saved" : "failed"); setSaveErr(r === true ? "" : String(r)); } });
    return () => { alive = false; };
  }, [users, categories, activity, hydrated, canSave, retryTick]);
  async function retrySave() {
    if (!canSave) {
      const { ok } = await idbGet("state");
      if (!ok) { setSaveErr("StorageBlocked"); setToast("Browser storage is blocked here — download a Backup instead."); return; }
      setCanSave(true);
    }
    setRetryTick((n) => n + 1);
  }
  const saveHelp = saveErr === "QuotaExceededError"
    ? "Browser storage is full (large photos/files). Download a Backup, then delete some files or free disk space."
    : saveErr === "StorageBlocked" || saveErr === "SecurityError" || saveErr === "InvalidStateError"
      ? "This browser/page is blocking storage (private window, blocked site data, or a preview frame). Open the app in a normal window at its own address."
      : "Could not save to this browser. Download a Backup, then click here to retry.";
  useEffect(() => {
    const flush = () => { if (latestRef.current && canSave) idbSet("state", latestRef.current); };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onVis); };
  }, [canSave]);


  async function exportBackup() {
    setToast("Preparing backup…");
    try {
      // assemble the JSON from pieces so big photos never have to sit in one giant string
      const parts = [`{"app":"sves-baja","v":1,"users":${JSON.stringify(users)},"activity":${JSON.stringify(activity)},"categories":[`];
      categories.forEach((c, ci) => { parts.push((ci ? "," : "") + `{"key":${JSON.stringify(c.key)},"files":[`); parts.push(c.key); });
      parts.length = 1;
      for (let ci = 0; ci < categories.length; ci++) {
        const c = categories[ci];
        parts.push((ci ? "," : "") + `{"key":${JSON.stringify(c.key)},"files":[`);
        const list = c.files || [];
        for (let fi = 0; fi < list.length; fi++) {
          const { file, ...rest } = list[fi];
          let rec = rest;
          if (file) {
            let data = "";
            try { data = await toB64(file); } catch (e) { data = ""; }
            rec = data ? { ...rest, fname: file.name, ftype: file.type, data } : rest;
          }
          parts.push((fi ? "," : "") + JSON.stringify(rec));
        }
        parts.push("]}");
      }
      parts.push("]}");
      const blob = new Blob(parts, { type: "application/json" });
      const fname = `sves-baja-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fname; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setToast(`Backup downloaded (${(blob.size / 1048576).toFixed(1)} MB). Check your Downloads folder.`);
    } catch (e) { setToast(`Backup failed: ${(e && (e.name || e.message)) || "unknown error"}`); }
  }
  async function importBackup(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.app !== "sves-baja") throw new Error("bad file");
      const ids = new Set((d.users || []).map((u) => u.id));
      setUsers([...(d.users || []), ...SEED_USERS.filter((u) => !ids.has(u.id))]);
      setCategories((prev) => prev.map((c) => {
        const m = (d.categories || []).find((x) => x.key === c.key);
        return m ? { ...c, files: (m.files || []).map(({ data, fname, ftype, ...rest }) => (data ? { ...rest, file: fromB64(data, fname || rest.name, ftype) } : rest)) } : c;
      }));
      setActivity(d.activity || []);
      setCanSave(true);
      setToast("Backup restored.");
    } catch (err) { setToast("That is not a valid backup file."); }
  }

  function logAct(action, detail, who) {
    const u = who || currentUser;
    setActivity((prev) => [{ t: Date.now(), user: u ? u.name : "System", role: u ? u.role : "", action, detail }, ...prev].slice(0, 300));
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function registerUser(u) { setUsers((prev) => [...prev, u]); }
  function handleLoginSuccess(u) { setCurrentUser(u); setToast(`Welcome, ${u.name}.`); logAct("Signed in", u.id, u); }
  function handleLogout() { logAct("Signed out", currentUser.id); setCurrentUser(null); setShowActivity(false); setSearchQ(""); setStep("landing"); setParsed(null); setFocusKey(null); setShowApprovals(false); }
  function approveUser(id) {
    logAct("Approved account", id);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: "approved" } : u)));
    setToast("Account approved.");
  }
  function rejectUser(id) {
    logAct("Rejected account", id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setToast("Account request rejected.");
  }

  if (!hydrated) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.paper, color: C.steel, ...mono, fontSize: 13 }}><style>{FONT_IMPORT}</style>Loading saved data…</div>;
  }
  if (!currentUser) {
    return <LoginPage users={users} onRegister={registerUser} onLoginSuccess={handleLoginSuccess} />;
  }

  const role = currentUser.role;
  const rank = ROLE_RANK[role];
  const canModify = CAN_MODIFY_ROLES.includes(role);
  const pendingUsers = users.filter((u) => u.status === "pending");

  const collegeCode = parsed?.college ? parsed.college.code : null;
  const yr = parsed?.year || null;
  const ev = parsed?.folder || null;
  const catLabel = parsed?.category ? parsed.category.label : "—";

  function handleProcess() {
    if (!promptText.trim()) return;
    const r = parsePrompt(promptText, categories, "retrieve", [...new Set(categories.flatMap((c) => c.files.map((f) => f.event)).filter(Boolean))]);
    setParsed(r);
    setFocusKey(r.category ? r.category.key : null);
  }
  function handleViewResults() {
    setStep("results");
    const t = buildTree();
    const evts = [];
    Object.keys(t).forEach((col) => Object.keys(t[col]).forEach((e) => Object.keys(t[col][e]).forEach((y) => evts.push({ college: col, year: y, event: e, cats: Object.keys(t[col][e][y]) }))));
    if (evts.length === 1) {
      setFocusEvt({ college: evts[0].college, year: evts[0].year, event: evts[0].event });
      if (!parsed?.category && evts[0].cats.length === 1) setFocusKey(evts[0].cats[0]);
    } else setFocusEvt(null);
  }
  function goToPrompt() { setFocusEvt(null); setUploadMode(false); setParsed(null); setPromptText(""); setStep("prompt"); }
  function goToUpload() { setUploadMode(true); setParsed(null); setFocusKey(null); setFocusEvt(null); setStep("results"); }
  function startOver() { setFocusEvt(null); setStep("landing"); setParsed(null); setFocusKey(null); setPromptText(""); setUploadMode(false); }

  const focusedCategory = categories.find((c) => c.key === focusKey) || null;
  const focusLocked = focusedCategory && rank < focusedCategory.minRole;

  // ---- hierarchy: College › Academic year › Event › Category, built from what is really stored ----
  const retrieving = !uploadMode;
  const scope = uploadMode
    ? { college: uploadCtx.college, year: uploadCtx.year, event: ctxEvent(uploadCtx) }
    : { college: parsed?.college?.code || null, year: parsed?.year || null, event: ev };
  const kw = retrieving ? (parsed?.keywords || []) : [];
  const rowMatch = (f) => (retrieving ? !!focusEvt && sameEvt(f, focusEvt) : inScope(f, scope));
  const needEvt = retrieving && !!focusedCategory && !focusEvt;
  function buildTree() {
    const cats = retrieving && parsed?.category ? categories.filter((c) => c.key === parsed.category.key) : categories;
    const t = {};
    cats.forEach((c) => c.files.forEach((f) => {
      if (!inScope(f, scope)) return;
      const col = f.college || "Unassigned", y = f.year || "No year", e = f.event || "No folder";
      t[col] = t[col] || {}; t[col][e] = t[col][e] || {}; t[col][e][y] = t[col][e][y] || {};
      t[col][e][y][c.key] = (t[col][e][y][c.key] || 0) + 1;
    }));
    return t;
  }
  const tree = retrieving ? buildTree() : {};
  // what is actually stored — used for examples and "nothing found" suggestions
  const storedPaths = (() => {
    const seen = new Set(), out = [];
    categories.forEach((c) => { if (!THREE.includes(c.key)) return; c.files.forEach((f) => { const k = [f.college, f.event, f.year].join("|"); if (!seen.has(k)) { seen.add(k); out.push({ college: f.college || "Unassigned", event: f.event || "No folder", year: f.year || "No year" }); } }); });
    return out.sort((a, b) => (a.college + a.event + a.year).localeCompare(b.college + b.event + b.year));
  })();
  function openStored(p) {
    const col = COLLEGES.find((c) => c.code === p.college) || null;
    setParsed({ college: col, year: p.year, month: null, eventYear: null, folder: p.event, category: null, contributor: null, intent: "retrieve", keywords: [] });
    setFocusKey(null); setFocusEvt({ college: p.college, year: p.year, event: p.event }); setStep("results");
  }
  function browseAll() {
    setParsed({ college: null, year: null, month: null, eventYear: null, folder: null, category: null, contributor: null, intent: "retrieve", keywords: [] });
    setFocusKey(null); setFocusEvt(null); setStep("results");
  }

  // upload view: College › Folder › Year with the number of Design, Photos and Reports in each
  const uploadTree = (() => {
    if (retrieving) return [];
    const m = {};
    const touch = (col, e, y) => { m[col] = m[col] || {}; m[col][e] = m[col][e] || {}; m[col][e][y] = m[col][e][y] || { design: 0, photos: 0, reports: 0 }; return m[col][e][y]; };
    if (!ctxComplete(uploadCtx)) return [];
    // only the folder being worked on — not everything ever uploaded
    const cur = touch(uploadCtx.college, uploadCtx.folder, uploadCtx.year);
    categories.forEach((c) => { if (THREE.includes(c.key)) cur[c.key] = c.files.filter((f) => inScope(f, scope)).length; });
    smartFiles.forEach((x) => { if (THREE.includes(x.cat)) cur[x.cat]++; }); // files waiting to be saved
    return Object.keys(m).sort().map((col) => ({ name: col, folders: Object.keys(m[col]).sort().map((e) => ({ name: e, years: Object.keys(m[col][e]).sort().map((y) => ({ name: y, cats: ["design", "photos", "reports"].map((k) => ({ ...categories.find((c) => c.key === k), n: m[col][e][y][k] })) })) })) }));
  })();

  const allRows = focusedCategory && !needEvt ? focusedCategory.files.map((f, i) => ({ f, i })).filter(({ f }) => rowMatch(f)) : [];
  const kwRows = kw.length ? allRows.filter(({ f }) => kw.some((k) => f.name.toLowerCase().includes(k))) : allRows;
  const keywordApplied = kw.length > 0 && kwRows.length > 0;
  const shownRows = keywordApplied ? kwRows : allRows;
  const scopeText = pathOf(scope).filter(Boolean).join(" › ");

  function startEdit(catKey, index, file) {
    setEditingFile({ catKey, index });
    setEditDraft({ name: file.name, meta: file.meta });
    setConfirmingDelete(null);
  }
  function saveEdit() {
    setCategories((prev) => prev.map((c) => {
      if (c.key !== editingFile.catKey) return c;
      const files = [...c.files];
      files[editingFile.index] = { ...files[editingFile.index], ...editDraft };
      return { ...c, files };
    }));
    logAct("Edited file", `${editDraft.name} (${editingFile.catKey})`);
    setToast("Changes saved.");
    setEditingFile(null);
  }
  function cancelEdit() { setEditingFile(null); }

  function askDelete(catKey, index) { setConfirmingDelete({ catKey, index }); setEditingFile(null); setConfirmingCategoryDelete(null); }
  function confirmDelete() {
    const delCat = categories.find((c) => c.key === confirmingDelete.catKey);
    logAct("Deleted file", `${delCat?.files[confirmingDelete.index]?.name || "file"} (${confirmingDelete.catKey})`);
    setCategories((prev) => prev.map((c) => {
      if (c.key !== confirmingDelete.catKey) return c;
      return { ...c, files: c.files.filter((_, i) => i !== confirmingDelete.index) };
    }));
    setToast("File deleted.");
    setConfirmingDelete(null);
  }
  function cancelDelete() { setConfirmingDelete(null); }

  function askDeleteCategory(catKey) { setConfirmingCategoryDelete(catKey); setEditingFile(null); setConfirmingDelete(null); }
  function confirmDeleteCategory() {
    const cat = categories.find((c) => c.key === confirmingCategoryDelete);
    setCategories((prev) => prev.map((c) => (c.key === confirmingCategoryDelete ? { ...c, files: c.files.filter((f) => !rowMatch(f)) } : c)));
    logAct("Deleted all files", `${cat ? cat.label : "category"} (${allRows.length})`);
    setToast(`All files removed from ${cat ? cat.label : "category"}.`);
    setConfirmingCategoryDelete(null);
  }
  function cancelDeleteCategory() { setConfirmingCategoryDelete(null); }

  // ---- Smart upload: auto-sort into folders ----
  const isLockedCat = (key) => { const c = categories.find((x) => x.key === key); return !c || rank < c.minRole; };
  async function handleFolderPick(e) {
    const all = Array.from(e.target.files || []).filter((f) => !/^(\.ds_store|thumbs\.db|desktop\.ini)$/i.test(f.name));
    e.target.value = "";
    if (!all.length) return;
    const rel = (f) => f.webkitRelativePath || f.name;
    if (!rel(all[0]).includes("/")) { setToast("Please choose a whole folder (not individual files)."); return; }
    const folder = rel(all[0]).split("/")[0];
    setToast(`Reading folder “${folder}” (${all.length} files)…`);
    // College / Year from the folder name, its sub-folders and file names; file dates as a fallback
    const times = all.map((f) => f.lastModified).filter(Boolean).sort((a, b) => a - b);
    const det = detectContext({ name: [folder, ...new Set(all.map(rel))].join(" "), lastModified: times[Math.floor(times.length / 2)] }, "").ctx;
    const merged = { college: det.college || uploadCtx.college, year: det.year || uploadCtx.year, folder };
    setUploadCtx(merged);
    // sort every file into Photos / Design / Reports (sub-folder names count, then file type and content)
    const SEG = [[/photo|image|pic|img|snap/, "photos"], [/design|cad|drawing|model|cae|blueprint/, "design"], [/report|doc|paper|writeup|thesis/, "reports"]];
    const found = [];
    for (let i = 0; i < all.length; i += 20) {
      const part = await Promise.all(all.slice(i, i + 20).map(async (file) => {
        const segs = rel(file).toLowerCase().split("/").slice(1, -1).reverse();
        let cat = null;
        for (const sg of segs) { const hit = SEG.find(([re]) => re.test(sg)); if (hit) { cat = hit[1]; break; } }
        if (!cat) cat = toThree((await classifyDeep(file)).cat);
        const ok = !isLockedCat(cat);
        return { file, cat: ok ? cat : "", auto: true, conf: ok ? "high" : "none", det: { ctx: {}, how: {} } };
      }));
      found.push(...part);
    }
    // staged until you press Save (so College / Folder / Year can still be corrected)
    setSmartFiles(found);
    setFocusKey(null);
    const counts = {};
    found.forEach((x) => { const k = x.cat || "unsorted"; counts[k] = (counts[k] || 0) + 1; });
    setToast(`Folder “${folder}” read: ${found.length} files — ` + Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ") + ". Check the details, then press Save.");
  }
  // keep the files in this browser (IndexedDB) under College / Folder / Year / Category
  async function storeFiles(list, ctx) {
    const entries = list.map((x) => ({ cat: x.cat, entry: { name: x.file.name, meta: formatBytes(x.file.size) || "uploaded just now", type: x.file.type, size: x.file.size, file: x.file, college: ctx.college, year: ctx.year, event: ctxEvent(ctx) } }));
    setCategories((prev) => prev.map((c) => {
      const mine = entries.filter((d) => d.cat === c.key).map((d) => d.entry);
      return mine.length ? { ...c, files: [...c.files, ...mine] } : c;
    }));
    entries.forEach((d) => logAct("Uploaded file", `${d.entry.name} → ${ctx.college}/${ctx.event || ctx.folder}/${ctx.year}/${d.cat}`));
    return { done: entries, failed: [] };
  }
  async function fileEntries(list, ctx = uploadCtx, filled = []) {
    const { done, failed } = await storeFiles(list, ctx);
    const label = (k) => (categories.find((c) => c.key === k) || {}).label || k;
    const where = `${ctx.college} › ${ctx.folder} › ${ctx.year}`;
    if (failed.length) { setToast(`${failed.length} file${failed.length > 1 ? "s" : ""} could not be saved`); return; }
    const counts = {};
    done.forEach((d) => { counts[label(d.cat)] = (counts[label(d.cat)] || 0) + 1; });
    setToast(`Folder stored under ${where}: ` + Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", "));
  }
  function setSmartCat(i, cat) { setSmartFiles((prev) => prev.map((x, j) => (j === i ? { ...x, cat, auto: false } : x))); }
  function removeSmart(i) { setSmartFiles((prev) => prev.filter((_, j) => j !== i)); }
  async function saveFolder() {
    if (smartFiles.length === 0) { setToast("Choose a folder first."); return; }
    if (!ctxComplete(uploadCtx)) { setToast("Choose college, folder name and year first."); return; }
    const left = smartFiles.filter((x) => !x.cat);
    if (left.length) { setToast(`${left.length} file${left.length > 1 ? "s" : ""} still need a category — choose one or remove them.`); return; }
    // saving the same folder twice does not create duplicates
    const have = new Set(categories.flatMap((c) => c.files.filter((f) => f.college === uploadCtx.college && f.event === uploadCtx.folder && f.year === uploadCtx.year).map((f) => c.key + "|" + f.name)));
    const fresh = smartFiles.filter((x) => !have.has(x.cat + "|" + x.file.name));
    const dup = smartFiles.length - fresh.length;
    const where = `${uploadCtx.college} › ${uploadCtx.folder} › ${uploadCtx.year}`;
    const counts = {};
    fresh.forEach((x) => { const l = (categories.find((c) => c.key === x.cat) || {}).label || x.cat; counts[l] = (counts[l] || 0) + 1; });
    if (fresh.length) await storeFiles(fresh, uploadCtx);
    setToast(`Saved ${where}: ` + (Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ") || "nothing new") + (dup ? ` (${dup} already stored, skipped)` : "") + ". Ready for another folder.");
    // open a clean page for the next record
    setSmartFiles([]); setUploadCtx({ college: "", year: "", folder: "" }); setFocusKey(null); setSearchQ(""); setTypeFilter("all");
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { /* ignore */ }
  }

  function startAdd(catKey) { setAddingTo(catKey); setPickedFiles([]); }
  function handleFilePick(e) {
    const chosen = Array.from(e.target.files || []);
    setPickedFiles((prev) => [...prev, ...chosen]);
    e.target.value = ""; 
  }
  function removePickedFile(index) {
    setPickedFiles((prev) => prev.filter((_, i) => i !== index));
  }
  async function saveAdd() {
    if (pickedFiles.length === 0) return;
    if (!ctxComplete(uploadCtx)) { setToast("Choose college, folder and year first."); return; }
    const target = addingTo, files = pickedFiles;
    setAddingTo(null); setPickedFiles([]);
    const { done, failed } = await storeFiles(files.map((f) => ({ file: f, cat: target })), uploadCtx);
    setToast(failed.length ? `${failed.length} file${failed.length > 1 ? "s" : ""} could not be saved` : `${done.length} file${done.length > 1 ? "s" : ""} added.`);
  }
  function cancelAdd() { setAddingTo(null); setPickedFiles([]); }

  function closePreview() { if (preview && preview.url) URL.revokeObjectURL(preview.url); setPreview(null); }
  // show the real content in the app: images, PDFs, text, Word and PowerPoint text; other binaries offer download
  async function viewFile(entry) {
    if (!entry.file) { setToast("No stored content for this entry."); return; }
    const f = entry.file, name = entry.name || f.name;
    const ext = (name.split(".").pop() || "").toLowerCase();
    const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml", pdf: "application/pdf" };
    const TEXTX = ["txt", "md", "csv", "json", "xml", "log", "dxf", "html", "htm", "css", "js", "py", "java", "c", "cpp", "ini", "yaml", "yml", "tsv", "rtf"];
    const base = { name, size: formatBytes(f.size), ext, entry };
    logAct("Viewed file", name);
    try {
      if (MIME[ext] && (MIME[ext].startsWith("image/") || ext === "pdf")) {
        const url = URL.createObjectURL(new Blob([f], { type: MIME[ext] }));
        setPreview({ ...base, kind: ext === "pdf" ? "pdf" : "image", url }); return;
      }
      if (["docx", "pptx"].includes(ext)) {
        const text = (await readFileText(f)).replace(/\n{3,}/g, "\n\n").trim();
        setPreview({ ...base, kind: "text", text: text || "(No readable text in this file.)", note: "Text extracted from the document. Download to see formatting, tables and pictures." }); return;
      }
      if (TEXTX.includes(ext) || (f.type || "").startsWith("text/")) {
        setPreview({ ...base, kind: "text", text: (await f.slice(0, 300000).text()) || "(Empty file.)" }); return;
      }
      // unknown type: show as text only if it really is text
      const head = new Uint8Array(await f.slice(0, 4096).arrayBuffer());
      const printable = head.length ? head.filter((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127)).length / head.length : 0;
      if (printable > 0.95) { setPreview({ ...base, kind: "text", text: await f.slice(0, 300000).text() }); return; }
      setPreview({ ...base, kind: "none", note: `.${ext || "this"} files are binary (CAD, Excel, archives…) and cannot be shown inside the browser. Use Download to open it in the right application.` });
    } catch (e) { setToast("Could not open this file."); }
  }

  function downloadFile(entry) {
    logAct("Downloaded file", entry.name);
    let blob, filename = entry.name;
    if (entry.file) {
     
      blob = entry.file;
    } else {
      
      blob = new Blob(
        [`Placeholder content for "${entry.name}".\n\nThis is a prototype — pre-loaded demo files don't have real stored content. Files you add yourself via "Add file" download for real.`],
        { type: "text/plain" }
      );
      if (!filename.toLowerCase().endsWith(".txt")) filename += ".txt";
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setToast(entry.file ? "Downloading file…" : "Downloaded demo placeholder — no real file was stored for this entry.");
  }

  return (
    <div style={{ ...body, background: C.paper, color: C.ink, minHeight: "100%" }}>
      <style>{FONT_IMPORT}</style>
      <Toast message={toast} />
      {preview && (
        <div onClick={closePreview} style={{ position: "fixed", inset: 0, background: "rgba(14,49,38,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "min(980px, 100%)", maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${C.line}` }}>
              <FileText size={16} style={{ color: C.steel }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...body, fontWeight: 700, fontSize: 14, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.name}</div>
                <div style={{ ...mono, fontSize: 11, color: C.lock }}>{preview.size}</div>
              </div>
              <button onClick={() => downloadFile(preview.entry)} style={{ ...display, fontWeight: 600, fontSize: 12.5, background: "#fff", color: C.graphite, border: `1px solid ${C.line}`, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Download size={13} /> Download</button>
              <span onClick={closePreview} style={{ cursor: "pointer", color: C.graphite, display: "flex" }}><XIcon size={18} /></span>
            </div>
            {preview.note && <div style={{ ...body, fontSize: 12.5, color: C.graphite, padding: "8px 16px", background: C.paper, borderBottom: `1px solid ${C.line}` }}>{preview.note}</div>}
            <div style={{ overflow: "auto", flex: 1, minHeight: 160 }}>
              {preview.kind === "image" && <img src={preview.url} alt={preview.name} style={{ display: "block", maxWidth: "100%", margin: "0 auto" }} />}
              {preview.kind === "pdf" && <iframe title={preview.name} src={preview.url} style={{ width: "100%", height: "76vh", border: "none" }} />}
              {preview.kind === "text" && <pre style={{ ...mono, fontSize: 12.5, lineHeight: 1.6, color: C.ink, margin: 0, padding: 16, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{preview.text}</pre>}
              {preview.kind === "none" && <div style={{ padding: "36px 24px", textAlign: "center", ...body, color: C.graphite, fontSize: 14 }}>Preview not available.</div>}
            </div>
          </div>
        </div>
      )}
      {saveState === "failed" && (
        <div style={{ background: "#FDECEA", color: "#8A2A1B", borderBottom: "1px solid #F3C1B9", padding: "10px 32px", fontSize: 13, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <AlertCircle size={15} /> <span style={{ flex: 1 }}>{saveHelp}</span>
          <span onClick={exportBackup} style={{ cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>Download backup now</span>
          <span onClick={retrySave} style={{ cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>Retry save</span>
        </div>
      )}

      {/* ===== chrome ===== */}
      <div style={{
        background: C.ink, color: "#fff", padding: "22px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        backgroundImage: `linear-gradient(${C.inkLine} 1px, transparent 1px), linear-gradient(90deg, ${C.inkLine} 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", ...display, fontWeight: 800, fontSize: 14, color: C.accent, flexShrink: 0 }}>SC</div>
          <div>
            <div style={{ ...display, fontWeight: 700, fontSize: 18, letterSpacing: "0.01em" }}>SVES CONNECT</div>
            <div style={{ fontSize: 11, color: "#A9CBB9", marginTop: 1, ...mono }}>BAJA Content Publication Module</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div onClick={() => saveState === "failed" && retrySave()} title={saveState === "failed" ? saveHelp : persistent ? "Stored permanently in this browser" : "Saved in this browser"} style={{ fontSize: 11, ...mono, color: saveState === "failed" ? "#FFB4A8" : "#A9CBB9", display: "flex", alignItems: "center", gap: 5, cursor: saveState === "failed" ? "pointer" : "default" }}>
            {saveState === "failed" ? <AlertCircle size={13} /> : saveState === "saving" ? <Loader2 size={13} /> : <CheckCircle2 size={13} />}
            {saveState === "failed" ? "Not saved — retry" : saveState === "saving" ? "Saving…" : "Saved"}
          </div>
          {role === "Admin" && (
            <div onClick={exportBackup} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", border: "1px solid #1F5A44", padding: "8px 12px", fontSize: 12, color: "#CFE9DC" }}>
              <Download size={13} /> Backup
            </div>
          )}
          {role === "Admin" && (
            <div onClick={() => backupInputRef.current && backupInputRef.current.click()} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", border: "1px solid #1F5A44", padding: "8px 12px", fontSize: 12, color: "#CFE9DC" }}>
              <UploadCloud size={13} /> Restore
            </div>
          )}
          <input ref={backupInputRef} type="file" accept="application/json,.json" onChange={importBackup} style={{ display: "none" }} />
          {role === "Admin" && (
            <div onClick={() => setShowActivity(true)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", border: "1px solid #1F5A44", padding: "8px 12px", fontSize: 12, color: "#CFE9DC" }}>
              <FileText size={13} /> Activity
            </div>
          )}
          {role === "Admin" && (
            <div onClick={() => setShowApprovals(true)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", border: `1px solid ${pendingUsers.length ? C.accent : "#1F5A44"}`, padding: "8px 12px", fontSize: 12, color: pendingUsers.length ? C.accent : "#CFE9DC" }}>
              <UserPlus size={13} /> Approvals {pendingUsers.length > 0 && `(${pendingUsers.length})`}
            </div>
          )}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{currentUser.name}</div>
            <div style={{ fontSize: 11, color: "#A9CBB9", ...mono }}>{role}</div>
          </div>
          <div onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", border: "1px solid #1F5A44", padding: "8px 12px", fontSize: 12, color: "#CFE9DC" }}>
            <LogOut size={13} /> Log out
          </div>
        </div>
      </div>

      {showApprovals && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,41,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 460, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ ...display, fontWeight: 700, fontSize: 18, color: C.ink }}>Pending approvals</div>
                <div style={{ ...body, fontSize: 12, color: C.graphite, marginTop: 2 }}>New sign-ups wait here until an Admin approves them.</div>
              </div>
              <IconBtn onClick={() => setShowApprovals(false)} title="Close"><XIcon size={14} /></IconBtn>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {pendingUsers.length === 0 ? (
                <div style={{ padding: "28px 24px", textAlign: "center", color: C.graphite, fontSize: 13, ...body }}>No pending requests right now.</div>
              ) : (
                pendingUsers.map((u) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", borderBottom: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...body, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{u.name}</div>
                      <div style={{ ...mono, fontSize: 11, color: C.graphite }}>{u.id} · {u.role}</div>
                    </div>
                    <IconBtn onClick={() => approveUser(u.id)} title="Approve" tone={C.success}><Check size={14} /></IconBtn>
                    <IconBtn onClick={() => rejectUser(u.id)} title="Reject" tone={C.danger}><XIcon size={14} /></IconBtn>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {showActivity && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,41,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 640, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ ...display, fontWeight: 700, fontSize: 18, color: C.ink }}>Admin dashboard</div>
                <div style={{ ...body, fontSize: 12, color: C.graphite, marginTop: 2 }}>Storage overview and recent activity.</div>
              </div>
              <IconBtn onClick={() => setShowActivity(false)} title="Close"><XIcon size={14} /></IconBtn>
            </div>
            <div style={{ overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: "16px 24px" }}>
                {[
                  ["Files stored", categories.reduce((n, c) => n + c.files.length, 0)],
                  ["Active users", users.filter((u) => u.status === "approved").length],
                  ["Pending", pendingUsers.length],
                ].map(([label, val]) => (
                  <div key={label} style={{ border: `1px solid ${C.line}`, padding: "12px 14px", background: C.paper }}>
                    <div style={{ ...display, fontWeight: 800, fontSize: 28, color: C.ink }}>{val}</div>
                    <div style={{ ...mono, fontSize: 10.5, color: C.graphite }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "0 24px 16px" }}>
                {categories.map((c) => {
                  const max = Math.max(1, ...categories.map((x) => x.files.length));
                  return (
                    <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <div style={{ ...body, fontSize: 12, width: 150, color: C.ink }}>{c.label}</div>
                      <div style={{ flex: 1, height: 8, background: C.line }}><div style={{ width: `${(c.files.length / max) * 100}%`, height: "100%", background: C.accent }} /></div>
                      <div style={{ ...mono, fontSize: 11, width: 24, textAlign: "right", color: C.graphite }}>{c.files.length}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ ...mono, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.accent, padding: "6px 24px" }}>Recent activity</div>
              {activity.length === 0 ? (
                <div style={{ padding: "20px 24px", color: C.graphite, fontSize: 13, ...body }}>Nothing recorded yet.</div>
              ) : activity.slice(0, 60).map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "9px 24px", borderTop: `1px solid ${C.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...body, fontSize: 13, color: C.ink }}><strong>{a.action}</strong> <span style={{ color: C.graphite }}>— {a.detail}</span></div>
                    <div style={{ ...mono, fontSize: 10.5, color: C.lock }}>{a.user}{a.role ? ` · ${a.role}` : ""}</div>
                  </div>
                  <div style={{ ...mono, fontSize: 10.5, color: C.lock, whiteSpace: "nowrap" }}>{timeAgo(a.t)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 32px 80px 32px" }}>

        {/* ===================== COMPOSE STEP ===================== */}
        {/* ===================== LANDING STEP ===================== */}
        {step === "landing" && (
          <section style={{ animation: "fadeInUp 0.35s ease" }}>
            <div style={{ marginBottom: 26 }}>
              <div style={{ ...mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accent, marginBottom: 8 }}>Start here</div>
              <h1 style={{ ...display, fontSize: 36, fontWeight: 700, margin: "0 0 6px 0", letterSpacing: "0.01em" }}>What would you like to do?</h1>
              <p style={{ color: C.graphite, fontSize: 14.5, maxWidth: 640, lineHeight: 1.55, margin: 0 }}>
                You're signed in as <strong>{role}</strong>. {canModify
                  ? "You can upload files directly, or search for existing content with a prompt."
                  : "You can search for existing content with a prompt — uploading is limited to Coordinators, Student Team Members and Admins."}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: canModify ? "1fr 1fr" : "1fr", gap: 12, maxWidth: canModify ? "none" : 480 }}>
              {canModify && (
                <div
                  onClick={goToUpload}
                  style={{
                    padding: "20px 20px", cursor: "pointer", border: `2px solid ${C.line}`, background: "#fff",
                    transition: "border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,106,19,0.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <UploadCloud size={19} style={{ color: C.accent }} />
                    <span style={{ ...display, fontWeight: 700, fontSize: 17, color: C.ink }}>Upload files</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.graphite, ...body }}>Go straight to a category and add files — no prompt needed.</div>
                </div>
              )}

              <div
                onClick={goToPrompt}
                style={{
                  padding: "20px 20px", cursor: "pointer", border: `2px solid ${C.line}`, background: "#fff",
                  transition: "border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,106,19,0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Search size={19} style={{ color: C.steel }} />
                  <span style={{ ...display, fontWeight: 700, fontSize: 17, color: C.ink }}>Retrieve existing content</span>
                </div>
                <div style={{ fontSize: 12.5, color: C.graphite, ...body }}>Describe what you need in plain English — open to every role.</div>
              </div>
            </div>
          </section>
        )}

        {/* ===================== PROMPT (RETRIEVE) STEP ===================== */}
        {step === "prompt" && (
          <section style={{ animation: "fadeInUp 0.35s ease" }}>
            <div onClick={startOver} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: C.steel, fontSize: 13, marginBottom: 18, ...mono }}>
              <ArrowLeft size={14} /> Start over
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ ...mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accent, marginBottom: 8 }}>Retrieve existing content</div>
              <h1 style={{ ...display, fontSize: 30, fontWeight: 700, margin: "0 0 6px 0", letterSpacing: "0.01em" }}>Describe what you're looking for</h1>
              <p style={{ color: C.graphite, fontSize: 14.5, maxWidth: 640, lineHeight: 1.55, margin: 0 }}>
                Plain English works — college, folder name, year, Photos / Design / Reports, whatever you know. Results are scoped to what <strong>{role}</strong> can see.
              </p>
            </div>

            <FieldLabel>Prompt</FieldLabel>
            <textarea
              value={promptText}
              onChange={(e) => { setPromptText(e.target.value); setParsed(null); }}
              placeholder={storedPaths[0] ? `e.g. Show the design files of the folder ${storedPaths[0].event} at ${storedPaths[0].college}, ${storedPaths[0].year}.` : "e.g. Show the photos of the folder BAJA at SVECW, 2025."}
              style={{ width: "100%", minHeight: 130, resize: "vertical", border: `1px solid ${C.line}`, background: "#fff", padding: 14, ...mono, fontSize: 13, lineHeight: 1.6, color: C.ink }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {storedPaths.slice(0, 3).map((p) => (
                <div key={p.college + p.event + p.year} onClick={() => { setPromptText(`Show everything in the folder ${p.event} at ${p.college}, ${p.year}.`); setParsed(null); }} style={{ ...mono, fontSize: 11, padding: "6px 10px", border: `1px solid ${C.line}`, background: "#fff", color: C.graphite, cursor: "pointer" }}>
                  {p.college} › {p.event} › {p.year}
                </div>
              ))}
              <div onClick={browseAll} style={{ ...mono, fontSize: 11, padding: "6px 10px", border: `1px solid ${C.accent}`, background: "#fff", color: C.accent, cursor: "pointer", fontWeight: 700 }}>Browse everything stored</div>
            </div>

            <button onClick={handleProcess} disabled={!promptText.trim()} style={{
              ...display, fontWeight: 700, fontSize: 15, background: promptText.trim() ? C.accent : C.lock, color: "#fff",
              border: "none", padding: "12px 22px", cursor: promptText.trim() ? "pointer" : "not-allowed", marginTop: 16,
            }}>
              Process prompt →
            </button>

            {parsed && (
              <div style={{ marginTop: 26 }}>
                <FieldLabel>Understood as</FieldLabel>
                <Panel>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, background: C.accentDim, color: "#B84A0E", padding: "5px 10px", fontSize: 11.5, ...mono, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <Search size={13} /> Retrieve request
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <ExtractItem label="College" value={parsed.college ? `${parsed.college.code} — ${parsed.college.name}` : "Not specified — all colleges"} />
                    <ExtractItem label="Year" value={parsed.year || "Not specified — all years"} />
                    <ExtractItem label="Folder" value={parsed.folder || "Not specified — all folders"} />
                    <ExtractItem label="Category" value={catLabel} />
                    <ExtractItem label="Requested by" value={parsed.contributor} />
                    <ExtractItem label="Signed in as" value={`${currentUser.name} (${role})`} />
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <FieldLabel>Resolved path</FieldLabel>
                    <div style={{ background: C.ink, color: "#DFF3E8", padding: "14px 16px", ...mono, fontSize: 13, overflowX: "auto", whiteSpace: "nowrap" }}>
                      <span style={{ color: "#5E8574" }}>/</span>
                      <span style={{ color: "#7FD1FF" }}>{collegeCode || "*"}</span>
                      <span style={{ color: "#5E8574" }}> / </span>
                      <span style={{ color: "#B9F27C" }}>{yr || "*"}</span>
                      <span style={{ color: "#5E8574" }}> / </span>
                      <span style={{ color: "#FFD27F" }}>{ev || "*"}</span>
                      <span style={{ color: "#5E8574" }}> / </span>
                      <span style={{ color: C.accent }}>{parsed.category ? parsed.category.label.replace(/\s+/g, "_") : "*"}</span>
                    </div>
                  </div>

                  <button onClick={handleViewResults} style={{ ...display, fontWeight: 700, fontSize: 15, background: C.ink, color: "#fff", border: "none", padding: "12px 22px", cursor: "pointer", marginTop: 18, display: "flex", alignItems: "center", gap: 8 }}>
                    View results <ArrowLeft size={14} style={{ transform: "rotate(180deg)" }} />
                  </button>
                </Panel>
              </div>
            )}
          </section>
        )}

        {/* ===================== RESULTS STEP ===================== */}
        {step === "results" && (
          <section style={{ animation: "fadeInUp 0.35s ease" }}>
            <div onClick={startOver} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: C.steel, fontSize: 13, marginBottom: 18, ...mono }}>
              <ArrowLeft size={14} /> Start over
            </div>
            {uploadMode && canModify && (
              <Panel style={{ marginBottom: 20 }}>
                <FieldLabel>Upload a folder</FieldLabel>
                <input ref={smartInputRef} type="file" webkitdirectory="" directory="" multiple onChange={handleFolderPick} style={{ display: "none" }} />
                <div onClick={() => smartInputRef.current?.click()} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "26px 12px", marginBottom: 16,
                  border: `1px dashed ${C.accent}`, background: C.paper, cursor: "pointer", textAlign: "center",
                }}>
                  <UploadCloud size={24} style={{ color: C.accent }} />
                  <div style={{ ...body, fontSize: 14, fontWeight: 600, color: C.ink }}>Choose a folder from your device</div>
                  <div style={{ ...mono, fontSize: 11, color: C.lock }}>The whole folder is stored under its own name; its contents are sorted into Photos, Design and Reports</div>
                </div>
                <FieldLabel>Stored as  College › Folder › Year  (filled from the folder — change if needed)</FieldLabel>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <select value={uploadCtx.college} onChange={(e) => setUploadCtx((p) => ({ ...p, college: e.target.value }))}
                    style={{ ...body, fontSize: 13, padding: "8px 10px", border: `1px solid ${uploadCtx.college ? C.line : C.warn}`, background: "#fff", color: C.ink }}>
                    <option value="">College…</option>
                    {COLLEGES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                  <input value={uploadCtx.folder} onChange={(e) => setUploadCtx((p) => ({ ...p, folder: e.target.value }))} placeholder="Folder name…"
                    style={{ ...body, fontSize: 13, padding: "8px 10px", minWidth: 200, border: `1px solid ${uploadCtx.folder ? C.line : C.warn}`, background: "#fff", color: C.ink }} />
                  <select value={uploadCtx.year} onChange={(e) => setUploadCtx((p) => ({ ...p, year: e.target.value }))}
                    style={{ ...body, fontSize: 13, padding: "8px 10px", border: `1px solid ${uploadCtx.year ? C.line : C.warn}`, background: "#fff", color: C.ink }}>
                    <option value="">Year…</option>
                    {ACAD_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                {ctxComplete(uploadCtx) && (
                  <div style={{ ...mono, fontSize: 11.5, color: C.steel, marginBottom: 14 }}>/{uploadCtx.college}/{uploadCtx.folder}/{uploadCtx.year}/&lt;Photos | Design | Reports&gt;</div>
                )}
                {smartFiles.length > 0 && (
                  <div style={{ marginTop: 14, maxHeight: 300, overflowY: "auto" }}>
                    {smartFiles.map((x, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#fff", border: `1px solid ${x.cat ? C.line : C.warn}`, marginBottom: 6, flexWrap: "wrap" }}>
                        <FileText size={15} style={{ color: C.steel, flexShrink: 0 }} />
                        <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                          <div style={{ ...body, fontSize: 12.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.file.name}</div>
                          <div style={{ ...mono, fontSize: 10.5, color: x.cat ? (x.auto ? C.success : C.lock) : C.warn }}>
                            {x.cat ? (x.auto ? "Auto-detected" : "Set by you") : "Not recognised — choose a folder"} · {formatBytes(x.file.size)}
                          </div>
                        </div>
                        <select value={x.cat} onChange={(e) => setSmartCat(i, e.target.value)} style={{ ...body, fontSize: 12.5, padding: "6px 8px", border: `1px solid ${C.line}`, background: "#fff", color: C.ink }}>
                          <option value="">Choose folder…</option>
                          {categories.filter((c) => THREE.includes(c.key) && rank >= c.minRole).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <IconBtn onClick={() => removeSmart(i)} title="Remove" tone={C.danger}><XIcon size={12} /></IconBtn>
                      </div>
                    ))}
                    <div style={{ marginTop: 8 }}>
                      <span onClick={() => setSmartFiles([])} style={{ ...mono, fontSize: 12, color: C.danger, cursor: "pointer", textDecoration: "underline" }}>Discard this folder</span>
                    </div>
                  </div>
                )}
              </Panel>
            )}

            <div style={{ ...mono, fontSize: 13, color: C.graphite, marginBottom: 22, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {(retrieving && focusEvt ? pathOf(focusEvt) : pathOf(scope).filter(Boolean)).map((p, i, arr) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: i === 0 ? C.ink : C.graphite, fontWeight: i === 0 ? 700 : 400 }}>{p}</span>
                  {i < arr.length - 1 && <ChevronRight size={12} style={{ color: C.lock }} />}
                </span>
              ))}
              {!(retrieving && focusEvt) && !pathOf(scope).some(Boolean) && <span>Entire archive</span>}
            </div>

            {uploadMode && <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.line}`, background: "#fff", padding: "0 12px" }}>
                  <Search size={14} style={{ color: C.steel }} />
                  <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search files across all folders…"
                    style={{ ...body, flex: 1, border: "none", outline: "none", padding: "11px 0", fontSize: 13.5, background: "transparent", color: C.ink }} />
                  {searchQ && <span onClick={() => setSearchQ("")} style={{ cursor: "pointer", color: C.lock, display: "flex" }}><XIcon size={13} /></span>}
                </div>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ ...body, fontSize: 13, padding: "0 10px", border: `1px solid ${C.line}`, background: "#fff", color: C.ink }}>
                  <option value="all">All types</option>
                  <option value="image">Images</option>
                  <option value="doc">Documents</option>
                  <option value="cad">CAD / design</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {(searchQ.trim() || typeFilter !== "all") && (() => {
                const q = searchQ.trim().toLowerCase();
                const hits = [];
                categories.forEach((c) => {
                  if (rank < c.minRole) return;
                  c.files.forEach((f) => {
                    if (q && !f.name.toLowerCase().includes(q)) return;
                    if (typeFilter !== "all" && fileKind(f.name, f.type || f.file?.type) !== typeFilter) return;
                    hits.push({ c, f });
                  });
                });
                return (
                  <Panel style={{ marginTop: 8, padding: 0 }}>
                    <div style={{ ...mono, fontSize: 11, color: C.graphite, padding: "10px 14px", borderBottom: `1px solid ${C.line}` }}>{hits.length} match{hits.length === 1 ? "" : "es"}</div>
                    {hits.length === 0 ? (
                      <div style={{ padding: "16px 14px", fontSize: 13, color: C.graphite, ...body }}>No files match.</div>
                    ) : hits.slice(0, 50).map(({ c, f }, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: `1px solid ${C.line}` }}>
                        <FileText size={15} style={{ color: C.steel, flexShrink: 0 }} />
                        <div onClick={() => setFocusKey(c.key)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                          <div style={{ ...body, fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                          <div style={{ ...mono, fontSize: 10.5, color: C.lock }}>{c.label} · {f.meta}</div>
                        </div>
                        <IconBtn onClick={() => viewFile(f)} title="View"><Eye size={13} /></IconBtn>
                        <IconBtn onClick={() => downloadFile(f)} title="Download"><Download size={13} /></IconBtn>
                      </div>
                    ))}
                  </Panel>
                );
              })()}
            </div>}

            <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px", maxWidth: 300 }}>
                <FieldLabel>{retrieving ? "Archive hierarchy" : "Current folder — College › Folder › Year"}</FieldLabel>
                <Panel style={{ padding: 8 }}>
                  {retrieving ? (
                  <>
                  {Object.keys(tree).length === 0 && (
                    <div style={{ padding: "14px 12px", fontSize: 13, color: C.graphite, ...body, lineHeight: 1.5 }}>
                      Nothing is stored{scopeText ? ` for ${scopeText}` : ""}{parsed?.category ? ` in ${parsed.category.label}` : ""} yet.
                      {storedPaths.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ ...mono, fontSize: 11, color: C.lock, marginBottom: 6 }}>WHAT IS STORED — CLICK TO OPEN</div>
                          {storedPaths.map((p) => (
                            <div key={p.college + p.event + p.year} onClick={() => openStored(p)} style={{ ...mono, fontSize: 11.5, padding: "6px 8px", marginBottom: 4, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", color: C.ink }}>{p.college} › {p.event} › {p.year}</div>
                          ))}
                          <div onClick={browseAll} style={{ ...mono, fontSize: 11.5, color: C.accent, cursor: "pointer", textDecoration: "underline", marginTop: 6 }}>Browse everything stored</div>
                        </div>
                      )}
                    </div>
                  )}
                  {Object.keys(tree).sort().map((col) => (
                    <div key={col} style={{ marginBottom: 6 }}>
                      <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: C.ink, padding: "8px 12px 4px", display: "flex", alignItems: "center", gap: 6 }}><Folder size={13} /> {col}</div>
                      {Object.keys(tree[col]).sort().map((e) => (
                        <div key={e} style={{ marginLeft: 12, borderLeft: `1px solid ${C.line}` }}>
                          <div style={{ ...mono, fontSize: 11.5, color: C.steel, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}><Folder size={12} /> {e}</div>
                          {Object.keys(tree[col][e]).sort().map((y) => (
                            <div key={y} style={{ marginLeft: 12, borderLeft: `1px solid ${C.line}` }}>
                              <div style={{ ...mono, fontSize: 11, color: C.graphite, padding: "3px 12px" }}>{y}</div>
                              {Object.keys(tree[col][e][y]).map((ck) => {
                                const cat = categories.find((c) => c.key === ck);
                                const locked = rank < cat.minRole;
                                const active = focusKey === ck && focusEvt && focusEvt.college === col && focusEvt.year === y && focusEvt.event === e;
                                return (
                                  <div key={ck} onClick={() => { setFocusKey(ck); setFocusEvt({ college: col, year: y, event: e }); }}
                                    style={{ marginLeft: 12, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", cursor: "pointer", fontSize: 13,
                                      background: active ? C.accentDim : "transparent", borderLeft: `2px solid ${active ? C.accent : "transparent"}`, color: locked ? C.lock : C.ink, fontWeight: active ? 700 : 500 }}>
                                    <span>{cat.label}</span>
                                    {locked ? <Lock size={12} style={{ color: C.lock }} /> : <span style={{ ...mono, fontSize: 10.5, color: C.lock }}>{tree[col][e][y][ck]}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                  </>
                  ) : (
                  <>
                  {uploadTree.length === 0 && (
                    <div style={{ padding: "14px 12px", fontSize: 13, color: C.graphite, ...body, lineHeight: 1.5 }}>Choose a folder to see its hierarchy here.</div>
                  )}
                  {uploadTree.map((col) => (
                    <div key={col.name} style={{ marginBottom: 6 }}>
                      <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: C.ink, padding: "8px 12px 4px", display: "flex", alignItems: "center", gap: 6 }}><Folder size={13} /> {col.name}</div>
                      {col.folders.map((fo) => (
                        <div key={fo.name} style={{ marginLeft: 12, borderLeft: `1px solid ${C.line}` }}>
                          <div style={{ ...mono, fontSize: 11.5, color: C.steel, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}><Folder size={12} /> {fo.name}</div>
                          {fo.years.map((yr2) => (
                            <div key={yr2.name} style={{ marginLeft: 12, borderLeft: `1px solid ${C.line}` }}>
                              <div style={{ ...mono, fontSize: 11, color: C.graphite, padding: "3px 12px" }}>{yr2.name}</div>
                              {yr2.cats.map((cat) => {
                                const locked = rank < cat.minRole;
                                const active = focusKey === cat.key && uploadCtx.college === col.name && uploadCtx.folder === fo.name && uploadCtx.year === yr2.name;
                                return (
                                  <div key={cat.key} onClick={() => { setUploadCtx((p) => ({ ...p, college: col.name, folder: fo.name, year: yr2.name })); setFocusKey(cat.key); }}
                                    style={{ marginLeft: 12, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", cursor: "pointer", fontSize: 13,
                                      background: active ? C.accentDim : "transparent", borderLeft: `2px solid ${active ? C.accent : "transparent"}`, color: locked ? C.lock : C.ink, fontWeight: active ? 700 : 500 }}>
                                    <span>{cat.label}</span>
                                    {locked ? <Lock size={12} style={{ color: C.lock }} /> : <span style={{ ...mono, fontSize: 11, color: C.graphite, fontWeight: 700 }}>{cat.n}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                  </>
                  )}
                </Panel>
                {!retrieving && (
                  <button onClick={saveFolder} disabled={smartFiles.length === 0} style={{
                    ...display, fontWeight: 700, fontSize: 14, color: "#fff", border: "none", padding: "12px 16px", marginTop: 12, width: "100%",
                    background: smartFiles.length ? C.accent : C.lock, cursor: smartFiles.length ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                    <Check size={15} /> {smartFiles.length ? `Save ${smartFiles.length} file${smartFiles.length > 1 ? "s" : ""} & add another folder` : "Save & add another folder"}
                  </button>
                )}
              </div>

              <div style={{ flex: "2 1 420px" }}>
                <FieldLabel>Content</FieldLabel>
                <Panel>
                  {(!focusedCategory || needEvt) && (
                    <p style={{ color: C.graphite, fontSize: 13.5, margin: 0 }}>{retrieving ? "Open a folder in the hierarchy on the left to see its files." : "Select a folder on the left to view its files."}</p>
                  )}

                  {focusedCategory && !needEvt && focusLocked && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: "20px 0" }}>
                      <Lock size={24} style={{ color: C.lock }} />
                      <h2 style={{ ...display, fontSize: 22, fontWeight: 700, margin: 0 }}>Restricted content</h2>
                      <p style={{ color: C.graphite, fontSize: 13.5, maxWidth: 400, margin: 0, lineHeight: 1.5 }}>
                        "{focusedCategory.label}" is only visible to Faculty Mentors, Event Coordinators and Admins. You're signed in as <strong>{currentUser.name}</strong> ({role}).
                      </p>
                    </div>
                  )}

                  {focusedCategory && !needEvt && !focusLocked && (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <h2 style={{ ...display, fontSize: 22, fontWeight: 700, margin: "0 0 4px 0" }}>{focusedCategory.label}</h2>
                        {!canModify && (
                          <span style={{ ...mono, fontSize: 10.5, color: C.lock, textTransform: "uppercase" }}>Read-only for your role</span>
                        )}
                        {canModify && allRows.length > 0 && (
                          confirmingCategoryDelete === focusedCategory.key ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ ...mono, fontSize: 11, color: C.danger }}>Delete all {allRows.length} files?</span>
                              <IconBtn onClick={confirmDeleteCategory} title="Confirm delete all" tone={C.danger}><Check size={13} /></IconBtn>
                              <IconBtn onClick={cancelDeleteCategory} title="Cancel"><XIcon size={13} /></IconBtn>
                            </div>
                          ) : (
                            <div onClick={() => askDeleteCategory(focusedCategory.key)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...mono, fontSize: 11, color: C.danger }}>
                              <Trash2 size={13} /> Delete all files in this category
                            </div>
                          )
                        )}
                      </div>
                      <div style={{ ...mono, fontSize: 11.5, color: C.lock, marginBottom: 16 }}>
                        {(retrieving && focusEvt ? pathOf(focusEvt) : pathOf(scope).filter(Boolean)).join(" › ")}{(retrieving && focusEvt) || scopeText ? " › " : ""}{focusedCategory.label}
                      </div>

                      {keywordApplied && (
                        <div style={{ ...mono, fontSize: 11.5, color: C.steel, background: C.paper, border: `1px solid ${C.line}`, padding: "7px 10px", marginBottom: 12 }}>
                          Showing {shownRows.length} of {allRows.length} matching “{kw.join(", ")}”
                        </div>
                      )}
                      {focusedCategory.key === "photos" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                          {shownRows.map(({ f, i }) => (
                            <PhotoTile
                              key={i} file={f} editable={canModify} onView={viewFile} onDownload={downloadFile}
                              isEditing={editingFile?.catKey === focusedCategory.key && editingFile?.index === i}
                              editDraft={editDraft} onChangeDraft={setEditDraft}
                              onStartEdit={() => startEdit(focusedCategory.key, i, f)}
                              onSave={saveEdit} onCancel={cancelEdit}
                              onDelete={() => askDelete(focusedCategory.key, i)}
                              isConfirmingDelete={confirmingDelete?.catKey === focusedCategory.key && confirmingDelete?.index === i}
                              onConfirmDelete={confirmDelete} onCancelDelete={cancelDelete}
                            />
                          ))}
                        </div>
                      ) : (
                        <div style={{ marginBottom: 14 }}>
                          {shownRows.length ? shownRows.map(({ f, i }) => (
                            <FileRow
                              key={i} file={f} editable={canModify} onView={viewFile} onDownload={downloadFile}
                              isEditing={editingFile?.catKey === focusedCategory.key && editingFile?.index === i}
                              editDraft={editDraft} onChangeDraft={setEditDraft}
                              onStartEdit={() => startEdit(focusedCategory.key, i, f)}
                              onSave={saveEdit} onCancel={cancelEdit}
                              onDelete={() => askDelete(focusedCategory.key, i)}
                              isConfirmingDelete={confirmingDelete?.catKey === focusedCategory.key && confirmingDelete?.index === i}
                              onConfirmDelete={confirmDelete} onCancelDelete={cancelDelete}
                            />
                          )) : <p style={{ color: C.graphite, fontSize: 13, margin: 0 }}>No files here yet.</p>}
                        </div>
                      )}

                      {canModify && (
                        addingTo === focusedCategory.key ? (
                          <div style={{ padding: "14px 16px", border: `1px dashed ${C.accent}`, background: C.paper }}>
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              accept={focusedCategory.key === "photos" ? "image/*" : undefined}
                              onChange={handleFilePick}
                              style={{ display: "none" }}
                            />

                            {pickedFiles.length === 0 ? (
                              <div onClick={() => fileInputRef.current?.click()} style={{
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                                padding: "24px 12px", border: `1px dashed ${C.line}`, background: "#fff",
                                cursor: "pointer", textAlign: "center",
                              }}>
                                <UploadCloud size={22} style={{ color: C.steel }} />
                                <div style={{ ...body, fontSize: 13, fontWeight: 600, color: C.ink }}>
                                  Choose {focusedCategory.key === "photos" ? "photos" : "files"} from your device
                                </div>
                                <div style={{ ...mono, fontSize: 11, color: C.lock }}>Browses your actual file system — not a text field</div>
                              </div>
                            ) : (
                              <>
                                <div style={{ marginBottom: 10 }}>
                                  {pickedFiles.map((f, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#fff", border: `1px solid ${C.line}`, marginBottom: 6 }}>
                                      <FileText size={15} style={{ color: C.steel, flexShrink: 0 }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ ...body, fontSize: 12.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                                        <div style={{ ...mono, fontSize: 10.5, color: C.lock }}>{formatBytes(f.size)}</div>
                                      </div>
                                      <IconBtn onClick={() => removePickedFile(i)} title="Remove" tone={C.danger}><XIcon size={12} /></IconBtn>
                                    </div>
                                  ))}
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <div onClick={() => fileInputRef.current?.click()} style={{ ...mono, fontSize: 11, color: C.steel, cursor: "pointer", fontWeight: 600 }}>+ Add more</div>
                                </div>
                              </>
                            )}

                            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                              <button onClick={saveAdd} disabled={pickedFiles.length === 0} style={{
                                ...display, fontWeight: 700, fontSize: 13, background: pickedFiles.length ? C.accent : C.lock, color: "#fff",
                                border: "none", padding: "9px 16px", cursor: pickedFiles.length ? "pointer" : "not-allowed",
                                display: "flex", alignItems: "center", gap: 6,
                              }}>
                                <Check size={13} /> Add {pickedFiles.length > 0 ? `${pickedFiles.length} file${pickedFiles.length > 1 ? "s" : ""}` : "files"}
                              </button>
                              <button onClick={cancelAdd} style={{ ...display, fontWeight: 600, fontSize: 13, background: "#fff", color: C.graphite, border: `1px solid ${C.line}`, padding: "9px 16px", cursor: "pointer" }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div onClick={() => startAdd(focusedCategory.key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", border: `1px dashed ${C.line}`, color: C.steel, cursor: "pointer", fontSize: 13, ...body, fontWeight: 600 }}>
                            <Plus size={15} /> Add {focusedCategory.key === "photos" ? "photo" : "file"} to {focusedCategory.label}
                          </div>
                        )
                      )}
                    </>
                  )}
                </Panel>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, fontSize: 12, marginTop: 18, flexWrap: "wrap" }}>
              {[["Signed in as", `${currentUser.name} · ${role}`], ["Scope", ROLE_SCOPE[role].scope], ["Access level", ROLE_SCOPE[role].access]].map(([k, v]) => (
                <div key={k} style={{ background: C.paper, border: `1px solid ${C.line}`, padding: "10px 14px", flex: "1 1 160px" }}>
                  <div style={{ color: C.lock, ...mono, fontSize: 10, textTransform: "uppercase" }}>{k}</div>
                  <div style={{ fontWeight: 700, marginTop: 3 }}>{v}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px 50px 32px", color: C.lock, fontSize: 11, ...mono, display: "flex", justifyContent: "space-between" }}>
        <span>SVES CONNECT — BAJA Content Publication Module</span>
        
      </div>
    </div>
  );
}

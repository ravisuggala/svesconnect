// Generic event types. A type only decides the starting folders and hints; folders are otherwise free (coordinators can make any
// folder or sub-folder), so any kind of event or project can be organised without code changes. Edit this file to add a type.
const F = (name, hints = [], isPublic = true) => ({ name, hints, public: isPublic });

const TYPES = [
  { key: "competition", label: "Technical competition (BAJA, Robocon, Hackathon)", folders: [
    F("Design", ["design", "cad", "drawing", "layout", "chassis", "model"]), F("Design Considerations", ["consideration", "analysis", "calculation", "simulation"]),
    F("Challenges Faced", ["challenge", "issue", "failure", "problem", "lesson"], false), F("Photos", ["photo", "img", "image", "pic"]), F("Reports", ["report", "summary", "final", "result"]),
    F("Faculty Expertise", ["faculty", "mentor", "expert", "notes"], false), F("Learning Outcomes", ["outcome", "learning", "feedback", "reflection"]), F("Others") ] },
  { key: "workshop", label: "Workshop / Seminar / FDP", folders: [
    F("Invitation & Brochure", ["invitation", "brochure", "poster", "flyer"]), F("Schedule & Agenda", ["schedule", "agenda", "programme", "timetable"]), F("Resource Material", ["slides", "presentation", "notes", "material", "ppt"]),
    F("Photos", ["photo", "img", "image", "pic"]), F("Attendance & Feedback", ["attendance", "feedback", "registration", "participants"], false), F("Reports", ["report", "summary", "minutes"]), F("Others") ] },
  { key: "cultural", label: "Cultural / Sports / Fest", folders: [
    F("Schedule", ["schedule", "programme", "agenda"]), F("Photos", ["photo", "img", "image", "pic"]), F("Videos & Media", ["video", "reel", "media"]),
    F("Results & Winners", ["result", "winner", "prize", "score"]), F("Reports", ["report", "summary"]), F("Others") ] },
  { key: "consultancy", label: "Consultancy / Industry project", folders: [
    F("Scope & Proposal", ["scope", "proposal", "mou", "requirement"]), F("Deliverables", ["deliverable", "output", "delivery"]), F("Reports", ["report", "summary", "final"]),
    F("Photos", ["photo", "img", "image", "pic"]), F("Agreements & Invoices", ["agreement", "invoice", "contract", "payment"], false), F("Others") ] },
  { key: "academic", label: "Academic / Research project", folders: [
    F("Literature", ["literature", "paper", "reference", "survey"]), F("Data", ["data", "dataset", "results"], false), F("Design", ["design", "model", "architecture"]),
    F("Thesis & Reports", ["thesis", "report", "dissertation"]), F("Presentations", ["presentation", "slides", "ppt"]), F("Photos", ["photo", "img", "image", "pic"]), F("Others") ] },
  { key: "outreach", label: "Outreach / Activity / Audit", folders: [F("Plan", ["plan", "proposal", "schedule"]), F("Photos", ["photo", "img", "image", "pic"]), F("Reports", ["report", "summary", "audit"]), F("Others")] },
  { key: "other", label: "Other", folders: [F("Photos", ["photo", "img", "image", "pic"]), F("Reports", ["report", "summary"]), F("Documents", ["document", "doc"]), F("Others")] },
];

const findType = (key) => TYPES.find((t) => t.key === key) || null;
const typeList = () => TYPES.map((t) => ({ key: t.key, label: t.label, folders: t.folders }));

module.exports = { TYPES, findType, typeList };

import { Home, FlaskConical, Search, CalendarDays, FolderKanban, LayoutDashboard, ShieldCheck, Bot } from 'lucide-react'

/**
 * Module registry: one entry per independently developed module.
 * Each module owns: src/modules/<key>/ (UI)  and  server/modules/<key>/ (API, mounted at /api/<key>).
 * Modules must not import from each other; share code only through src/ui and src/core.
 */
export const MODULES = [
  { key: 'equipment', path: '/equipment', label: 'Lab Equipment', icon: FlaskConical, phase: 'Phase 2', status: 'partial', needsLogin: true,
    summary: 'Register and manage laboratory equipment, with department templates, approvals, documents and QR codes.',
    features: ['Equipment registration forms with department-specific templates (EEE, ECE, CSE, AI/ML, Civil, Mechanical)', 'High-value equipment tracking (above ₹1.5 lakh)', 'Warranty, AMC, calibration and service schedules', 'Document uploads: invoices, manuals, certificates', 'Registered by, verified by (HOD), approved by (Principal) workflow', 'QR code generation for assets'] },
  { key: 'search', path: '/search', label: 'Search & Assistant', icon: Search, phase: 'Phase 3', status: 'live', needsLogin: false,
    summary: 'Find equipment and facilities across SVES institutions with filters and an AI assistant.',
    features: ['Keyword and structured search with dynamic filters', 'Institution, building and lab location search', 'Export results to CSV and PDF', 'Voice search', 'Equipment recommendations', 'AI chatbot answers with sources (available now at /assistant)'] },
  { key: 'events', path: '/events', label: 'Events & Archive', icon: CalendarDays, phase: 'Phase 4', status: 'live', needsLogin: false,
    summary: 'Publish and archive the record of any event or project (BAJA, workshops, fests, consultancy): files, photos, reports and credit.',
    features: ['College › Academic year › Event › Folder › File, in the database and on disk', 'Any event type; folders and sub-folders are created from the file details', 'One login: the event coordinator lands on their event', 'Public pages with an auto-made summary of the event, college-wise'] },
  { key: 'projects', path: '/projects', label: 'Projects & R&D', icon: FolderKanban, phase: 'Phase 5', status: 'planned', needsLogin: true,
    summary: 'Track consultancy, academic and research projects, publications, patents and grants.',
    features: ['Consultancy and academic project records', 'Research papers, patents and citations', 'Seed and sponsored projects, grants and financial aid', 'Faculty research profiles', 'Crossref / OpenAlex / ORCID integration'] },
  { key: 'dashboards', path: '/dashboards', label: 'Dashboards', icon: LayoutDashboard, phase: 'Phase 6', status: 'partial', needsLogin: true,
    summary: 'Role-based analytics for Admin, HOD, Lab In-charge, Principal and the public.',
    features: ['Real-time KPIs, charts and graphs', 'Equipment status, utilisation and investment', 'Department and institution views', 'Reports for audits and accreditation'] },
  { key: 'admin', path: '/admin', label: 'Administration', icon: ShieldCheck, phase: 'Phase 1', status: 'live', needsLogin: true, roles: ['admin'],
    summary: 'Administrator console: every college, account, lab, event and document in one place.',
    features: ['Create any type of account in any college; unlock, reset or set passwords; disable or delete', 'Open any college as its Principal would: labs, equipment, events, files', 'Approve equipment and publish events anywhere', 'Cross-college overview of labs, equipment, events and files'] },
]
export const NAV_ICONS = { Home, Bot }

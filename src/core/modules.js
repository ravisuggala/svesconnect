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
  { key: 'search', path: '/search', label: 'Search & Assistant', icon: Search, phase: 'Phase 3', status: 'partial', needsLogin: false,
    summary: 'Find equipment and facilities across SVES institutions with filters and an AI assistant.',
    features: ['Keyword and structured search with dynamic filters', 'Institution, building and lab location search', 'Export results to CSV and PDF', 'Voice search', 'Equipment recommendations', 'AI chatbot answers with sources (available now at /assistant)'] },
  { key: 'events', path: '/events', label: 'Events & Archive', icon: CalendarDays, phase: 'Phase 4', status: 'partial', needsLogin: true,
    summary: 'Publish and archive the record of events such as BAJA: files, photos, reports and credit.',
    features: ['College › Academic year › Event › Category folder structure', 'Role-based access: student, mentor, coordinator, reviewer, admin', 'Prompt-driven upload and retrieval (current prototype)', 'One page per event'] },
  { key: 'projects', path: '/projects', label: 'Projects & R&D', icon: FolderKanban, phase: 'Phase 5', status: 'planned', needsLogin: true,
    summary: 'Track consultancy, academic and research projects, publications, patents and grants.',
    features: ['Consultancy and academic project records', 'Research papers, patents and citations', 'Seed and sponsored projects, grants and financial aid', 'Faculty research profiles', 'Crossref / OpenAlex / ORCID integration'] },
  { key: 'dashboards', path: '/dashboards', label: 'Dashboards', icon: LayoutDashboard, phase: 'Phase 6', status: 'planned', needsLogin: true,
    summary: 'Role-based analytics for Admin, HOD, Lab In-charge, Principal and the public.',
    features: ['Real-time KPIs, charts and graphs', 'Equipment status, utilisation and investment', 'Department and institution views', 'Reports for audits and accreditation'] },
  { key: 'admin', path: '/admin', label: 'Administration', icon: ShieldCheck, phase: 'Phase 1', status: 'planned', needsLogin: true, roles: ['admin'],
    summary: 'Manage users, roles and audit logs.',
    features: ['User approval and roles', 'Audit logs for search, chat and edits', 'Master data: institutions, departments'] },
]
export const NAV_ICONS = { Home, Bot }

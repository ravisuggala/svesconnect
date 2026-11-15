# SVES Connect: project conventions

Single app: React 19 + Vite (`src/`) and Express 5 + MySQL via `mysql2` (`server/`). Deployed to cPanel/WHM (Setup Node.js App). See DEPLOY.md.

## Module rules (keep development unmixed)
- One module = one route prefix, one UI folder `src/modules/<key>/`, one API folder `server/modules/<key>/` mounted at `/api/<key>`.
- Register every module in `src/core/modules.js`. Unbuilt modules render `ModulePlaceholder` with their planned scope.
- Modules never import from each other; shared code goes in `src/ui` (components), `src/core` (auth, api) or `server/core`.
- No new npm packages without approval. Auth uses Node crypto (scrypt + HS256 JWT), not bcrypt/jsonwebtoken.
- Schema: `server/db/schema.sql` (idempotent); run with `npm run migrate`. No Mongo/Mongoose.

## Design system (derived from the Vishnu logo)
- All colors/spacing/radius/shadows/gradients are CSS variables in `src/styles/tokens.css`. Never hardcode colors in components.
- Palette: primary purple `#A1248D`, secondary orange `#C2570C` (buttons) / `#F08327` (graphics only), accent lime `#A8CC3C` (decoration; text `#4D7C0F`), ink `#2A0F36`, bg `#FBF8FC`, text `#1F1F1F`, muted `#5B5568`. All text pairs meet WCAG AA.
- Max 2-3 brand colors per screen: purple + orange; lime only for status/small highlights.
- Fonts: Plus Jakarta Sans (headings), Inter (body).
- Components live in `src/ui/index.jsx` (Button, Card, Input, Select, Field, Modal, Table, Badge, Navbar, Sidebar, ToastProvider/useToast, Loader, Skeleton, EmptyState). Use them; add new shared ones there.
- Motion 150-250ms; respect prefers-reduced-motion. Forms show inline validation messages.
- Logo: the ORIGINAL Vishnu logo `public/logo.jpg` (from reference/svecw_logo.jpg; never redraw or alter it; favicon `public/favicon.png`). Site name: "SVES Connect", organisation "Sri Vishnu Educational Society".

## Status
- Done: design system, shell/layouts, home, login/register (any email), MySQL auth, AI assistant (`/assistant`).
- `src/pages/Documents.jsx` is the legacy BAJA prototype (browser storage, own login, old styling) mounted at `/events`; to be rebuilt as the Events module.
- Next: Lab Equipment (Module 1), Search (Module 2), Events, Projects/R&D, Dashboards.

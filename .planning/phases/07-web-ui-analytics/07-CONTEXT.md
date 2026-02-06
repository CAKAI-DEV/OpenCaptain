# Phase 7: Web UI & Analytics - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Web interface for dashboard, task management, and analytics visualization. Users can log in, view project health, manage tasks (Kanban + list views), and see analytics at individual/squad/project levels.

**Key change from previous attempt:** Using Next.js instead of Vite.

</domain>

<decisions>
## Implementation Decisions

### Framework Setup
- **Next.js with App Router** — Modern approach with server components, layouts, loading states
- **src/ directory structure** — src/app/ for cleaner root, separates config from code
- **shadcn/ui components** — Copy into codebase, full control, Tailwind-based
- **Turbopack for dev** — Faster dev builds, Next.js native

### Auth Integration
- **Claude's discretion on auth state** — Decide between client-only or server+client hybrid based on security and SSR needs
- **Claude's discretion on route protection** — Middleware vs layout-level guards
- **Claude's discretion on API calls** — Direct from client vs Next.js API route proxy
- **Claude's discretion on login UX** — Simple password or include magic link based on backend capabilities

### Task Views
- **dnd-kit for drag-and-drop** — Modern, accessible, tree-shakeable
- **Optimistic updates** — UI updates instantly, rollback on error
- **Claude's discretion on project selection** — Sidebar list vs header dropdown based on typical project count
- **Claude's discretion on filter persistence** — URL params vs local state based on workflow needs

### Analytics Charts
- **Claude's discretion on chart library** — Recharts vs Tremor vs Chart.js based on chart types needed
- **Claude's discretion on layout** — Tabbed views vs role-based single view
- **Claude's discretion on date range** — Presets only, custom picker, or both
- **Claude's discretion on health indicators** — Color-coded cards vs subtle dots

### Claude's Discretion Summary
User explicitly delegated these decisions:
- Auth architecture (state location, protection mechanism, API routing, login options)
- Project selection UI pattern
- Filter state persistence approach
- Chart library selection
- Analytics dashboard layout structure
- Date range picker design
- Health indicator visual prominence

</decisions>

<specifics>
## Specific Ideas

- Use Next.js 15+ with App Router and Turbopack
- shadcn/ui for component library (same pattern as before, works well)
- dnd-kit for Kanban (proven choice from Vite attempt)
- Optimistic updates for snappy task interactions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-web-ui-analytics*
*Context gathered: 2026-02-06*

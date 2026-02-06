---
phase: 08-workflow-builder-integrations
plan: 06
subsystem: api
tags: [drizzle, postgres, hono, zod, jsonb, workflows, react-flow]

# Dependency graph
requires:
  - phase: 08-01
    provides: workflow editor UI with React Flow nodes/edges
provides:
  - Workflow database persistence with JSONB nodes/edges
  - GET /api/v1/projects/:projectId/workflows endpoint
  - POST /api/v1/projects/:projectId/workflows endpoint
  - Workflow service layer with upsert pattern
affects: [08-07, frontend-workflow, workflow-activation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSONB columns for flexible React Flow node/edge storage
    - One workflow per project (unique constraint)
    - Upsert pattern with onConflictDoUpdate

key-files:
  created:
    - src/shared/db/schema/workflows.ts
    - src/features/workflows/workflows.types.ts
    - src/features/workflows/workflows.service.ts
    - src/features/workflows/workflows.routes.ts
    - src/features/workflows/index.ts
    - src/shared/db/migrations/0015_nosy_piledriver.sql
  modified:
    - src/shared/db/schema/index.ts
    - src/index.ts

key-decisions:
  - "JSONB for nodes/edges (flexible, matches React Flow structure)"
  - "One workflow per project via unique constraint"
  - "Upsert pattern for save (creates or updates)"
  - "Return empty arrays if no workflow exists (new project friendly)"

patterns-established:
  - "Workflow schema: JSONB columns for flexible UI component storage"
  - "Project-scoped resources: unique constraint on project_id"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 8 Plan 6: Workflow Persistence Summary

**Backend API for workflow persistence with JSONB storage for React Flow nodes/edges and upsert save pattern**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-06T14:35:44Z
- **Completed:** 2026-02-06T14:38:02Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Database schema with JSONB columns for flexible node/edge storage
- GET endpoint returns saved workflow or empty arrays for new projects
- POST endpoint uses upsert pattern (create or update)
- Full auth and visibility middleware protection

## Task Commits

Each task was committed atomically:

1. **Task 1: Create workflow database schema** - `7c6a089` (feat)
2. **Task 2: Create workflows service and routes** - `db92842` (feat)

## Files Created/Modified

- `src/shared/db/schema/workflows.ts` - Workflow table with JSONB nodes/edges
- `src/shared/db/schema/index.ts` - Export workflows schema
- `src/shared/db/migrations/0015_nosy_piledriver.sql` - Migration for workflows table
- `src/features/workflows/workflows.types.ts` - Zod schemas for API validation
- `src/features/workflows/workflows.service.ts` - getWorkflow and saveWorkflow functions
- `src/features/workflows/workflows.routes.ts` - GET/POST route handlers
- `src/features/workflows/index.ts` - Feature module exports
- `src/index.ts` - Mount workflowsRoutes at /api/v1/projects

## Decisions Made

- **JSONB for nodes/edges:** Flexible storage that matches React Flow's node/edge structure exactly, no schema migrations needed for UI changes
- **One workflow per project:** Unique constraint prevents accidental duplicates, simplifies query pattern
- **Upsert save pattern:** Single endpoint handles both create and update, reduces frontend complexity
- **Empty arrays for missing workflow:** New projects get sensible defaults without requiring workflow creation first

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed z.record() argument count**
- **Found during:** Task 2 (workflows.types.ts)
- **Issue:** `z.record(z.unknown())` missing key type argument
- **Fix:** Changed to `z.record(z.string(), z.unknown())`
- **Files modified:** src/features/workflows/workflows.types.ts
- **Verification:** bun run typecheck passes
- **Committed in:** db92842 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript error fix. No scope change.

## Issues Encountered

None - plan executed smoothly after bug fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend persistence ready for frontend integration (08-07)
- Workflow configurations can now survive page refresh
- Ready for workflow activation feature (converting saved config to actual check-in/escalation blocks)

---
*Phase: 08-workflow-builder-integrations*
*Completed: 2026-02-06*

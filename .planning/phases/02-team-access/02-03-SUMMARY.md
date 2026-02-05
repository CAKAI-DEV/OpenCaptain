---
phase: 02-team-access
plan: 03
subsystem: auth
tags: [casl, authorization, visibility, middleware, grants]

# Dependency graph
requires:
  - phase: 01-core-infrastructure
    provides: Database setup, auth middleware, error handling
  - phase: 02-01
    provides: Projects and organizations schema
  - phase: 02-02
    provides: Project membership, squads, roles with tier-based hierarchy
provides:
  - CASL-based authorization abilities
  - Visibility grants for cross-squad access
  - Visibility middleware for protected routes
  - Context endpoint for frontend visibility state
affects: [03-workspace, work-items, analytics]

# Tech tracking
tech-stack:
  added: ["@casl/ability"]
  patterns:
    - CASL PureAbility with SubjectRawRule for type-safe authorization
    - Middleware-based visibility context loading
    - Pre-computed visibleSquadIds for query filtering

key-files:
  created:
    - src/shared/db/schema/visibility-grants.ts
    - src/shared/lib/permissions/abilities.ts
    - src/features/visibility/visibility.types.ts
    - src/features/visibility/visibility.service.ts
    - src/features/visibility/visibility.middleware.ts
    - src/features/visibility/visibility.routes.ts
    - src/features/visibility/index.ts
  modified:
    - src/shared/db/schema/index.ts
    - src/shared/lib/permissions/index.ts
    - src/index.ts

key-decisions:
  - "Default visibility is project-wide (unrestricted users see all)"
  - "CASL PureAbility with raw rules for flexible conditions"
  - "Empty visibleSquadIds array means all (for admin/PM/unrestricted)"
  - "Visibility grants use upsert for idempotent operations"

patterns-established:
  - "visibilityMiddleware runs after authMiddleware"
  - "c.get('userContext') provides full user context in handlers"
  - "computeVisibleSquads returns [] for unrestricted visibility"

# Metrics
duration: 4min
completed: 2026-02-05
---

# Phase 2 Plan 3: Visibility Rules Summary

**CASL-based authorization with visibility grants, middleware enforcement, and context API for squad-scoped data access**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-05T11:06:30Z
- **Completed:** 2026-02-05T11:10:47Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Installed @casl/ability for declarative authorization rules
- Created visibility_grants table for cross-squad access
- Implemented CASL abilities supporting admin, PM, and squad-scoped visibility
- Built visibility middleware that loads user context and builds abilities
- Added visibility routes for grant management and context retrieval

## Task Commits

Each task was committed atomically:

1. **Task 1: Create visibility grants schema and CASL abilities** - `60725ae` (feat)
2. **Task 2: Create visibility service and middleware** - `52d0974` (feat)
3. **Task 3: Create visibility routes and integrate middleware** - `4f943b7` (feat)

## Files Created/Modified

- `src/shared/db/schema/visibility-grants.ts` - Cross-squad visibility grants table
- `src/shared/lib/permissions/abilities.ts` - CASL ability definitions with defineAbilitiesFor
- `src/features/visibility/visibility.types.ts` - GrantVisibilityInput, UserVisibilityContext
- `src/features/visibility/visibility.service.ts` - Grant CRUD, loadUserContext, computeVisibleSquads
- `src/features/visibility/visibility.middleware.ts` - Sets ability, userContext, visibleSquadIds on context
- `src/features/visibility/visibility.routes.ts` - POST/DELETE /grants, GET /grants/:userId, GET /context
- `src/features/visibility/index.ts` - Feature exports
- `src/index.ts` - Mounted visibility routes

## Decisions Made

- **Default unrestricted:** Per CONTEXT, default visibility is project-wide, not squad-scoped
- **CASL with raw rules:** Used PureAbility with SubjectRawRule for type-safe condition objects
- **Empty array convention:** Empty visibleSquadIds means "all visible" for simplicity in query logic
- **Upsert for grants:** grantVisibility uses onConflictDoUpdate for idempotent operations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Visibility system complete with CASL abilities
- Middleware ready to add to any protected route
- Grant management endpoints available for admin use
- Phase 02-team-access complete (3/3 plans done)
- Ready for Phase 03 workspace configuration

---

*Phase: 02-team-access*
*Completed: 2026-02-05*

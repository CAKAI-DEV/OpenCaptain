---
phase: 02-team-access
plan: 02
subsystem: api
tags: [drizzle, postgres, roles, squads, teams, permissions]

# Dependency graph
requires:
  - phase: 01-core-infrastructure
    provides: Database setup, auth middleware, error handling patterns
  - phase: 02-01
    provides: Projects and organizations schema
provides:
  - Project membership with role assignment (admin, pm, squad_lead, member)
  - Squad management with 1-level nesting hierarchy
  - Squad membership tracking
  - Predefined role definitions with tier-based capabilities
  - Role assignment APIs with auto-computed reporting hierarchy
affects: [02-03-permissions, 03-project-config, work-items]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Tier-based role hierarchy (admin=0, pm=1, squad_lead=2, member=3)
    - Squad nesting limit enforcement at service layer
    - Upsert pattern for role assignment

key-files:
  created:
    - src/shared/db/schema/project-members.ts
    - src/shared/db/schema/squads.ts
    - src/shared/db/schema/squad-members.ts
    - src/shared/lib/permissions/roles.ts
    - src/features/teams/teams.service.ts
    - src/features/teams/teams.routes.ts
    - src/features/roles/roles.service.ts
    - src/features/roles/roles.routes.ts
  modified:
    - src/shared/db/schema/index.ts
    - src/shared/lib/index.ts
    - src/index.ts

key-decisions:
  - "Capability type derived from CAPABILITIES object keys for type safety"
  - "Squad nesting limit enforced at service layer, not database constraint"
  - "Role assignment uses upsert pattern - update if exists, insert if not"
  - "Default reportsTo computed by finding closest higher-tier member in project"

patterns-established:
  - "Tier-based roles: admin=0, pm=1, squad_lead=2, member=3"
  - "hasCapability(role, capability) for permission checks"
  - "Service layer validation before database operations"

# Metrics
duration: 7min
completed: 2026-02-05
---

# Phase 2 Plan 2: Role Hierarchy and Squad Management Summary

**Tier-based role system with PREDEFINED_ROLES, squad CRUD with 1-level nesting enforcement, and project membership assignment with auto-computed reporting hierarchy**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-05T10:55:32Z
- **Completed:** 2026-02-05T11:02:40Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Created project_members, squads, and squad_members database tables
- Implemented PREDEFINED_ROLES with tier-based hierarchy (admin=0, pm=1, squad_lead=2, member=3)
- Built squad CRUD with 1-level nesting limit enforcement (sub-sub-squads return 400)
- Role assignment with upsert behavior and auto-computed reporting hierarchy
- Users can hold different roles across multiple projects

## Task Commits

Each task was committed atomically:

1. **Task 1: Create membership and squad schemas** - `7135178` (feat)
2. **Task 2: Create teams service with squad hierarchy** - `ad0400d` (feat)
3. **Task 3: Create roles service with project assignment** - `d544483` (feat)

## Files Created/Modified
- `src/shared/db/schema/project-members.ts` - User-project-role junction table with unique constraint
- `src/shared/db/schema/squads.ts` - Squad definitions with parent reference for nesting
- `src/shared/db/schema/squad-members.ts` - User-squad membership tracking
- `src/shared/lib/permissions/roles.ts` - PREDEFINED_ROLES, CAPABILITIES, getRoleTier, hasCapability helpers
- `src/features/teams/teams.service.ts` - Squad CRUD with nesting limit enforcement
- `src/features/teams/teams.routes.ts` - Squad API endpoints
- `src/features/roles/roles.service.ts` - Role assignment with reporting hierarchy
- `src/features/roles/roles.routes.ts` - Role assignment API endpoints
- `src/index.ts` - Mounted teams and roles routes

## Decisions Made
- Used CAPABILITIES object as source of truth for Capability type (solves TypeScript readonly array intersection issue)
- Enforced squad nesting limit at service layer rather than database constraint (easier error messaging)
- Role assignment uses upsert pattern for idempotent operations
- Auto-computes reportsTo by finding closest higher-tier member in same project

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- TypeScript readonly array type inference issue with Capability type - resolved by defining CAPABILITIES first and deriving type from keys
- Linter caught unused variable in removeSquadMember - removed unnecessary findFirst call

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Role hierarchy and squad management APIs ready for permission enforcement
- Ready for 02-03 (fine-grained permissions middleware)
- All verification criteria met:
  - Squad nesting limited to 1 level
  - Users can hold different roles per project
  - Predefined roles have correct tier hierarchy

---
*Phase: 02-team-access*
*Completed: 2026-02-05*

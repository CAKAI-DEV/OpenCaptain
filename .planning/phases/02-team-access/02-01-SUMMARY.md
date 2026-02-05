---
phase: 02-team-access
plan: 01
subsystem: auth
tags: [invitations, projects, argon2, nanoid, drizzle]

# Dependency graph
requires:
  - phase: 01-core-infrastructure
    provides: Auth middleware, user/org schema, email service
provides:
  - Projects table for project-scoped work
  - Email invitations with hashed tokens
  - Shareable invite links with 7-day expiry
  - Accept invitation flow with timing-safe verification
affects: [02-02, 02-03, 03-workspace]

# Tech tracking
tech-stack:
  added: [nanoid]
  patterns: [timing-attack-prevention, token-hashing]

key-files:
  created:
    - src/shared/db/schema/projects.ts
    - src/shared/db/schema/invitations.ts
    - src/shared/db/schema/invite-links.ts
    - src/features/invitations/invitations.types.ts
    - src/features/invitations/invitations.email.ts
    - src/features/invitations/invitations.service.ts
    - src/features/invitations/invitations.routes.ts
    - src/features/invitations/index.ts
    - src/features/projects/projects.types.ts
    - src/features/projects/projects.service.ts
    - src/features/projects/projects.routes.ts
    - src/features/projects/index.ts
  modified:
    - src/shared/db/schema/index.ts
    - src/index.ts

key-decisions:
  - "Use Argon2 for invitation token hashing (same as auth tokens)"
  - "Auto-add existing users when invited (per RESEARCH recommendation)"
  - "Timing attack prevention via dummy hash comparison on failed lookups"

patterns-established:
  - "Secure token flow: nanoid for generation, Argon2 for storage"
  - "Accept endpoint tries both invitation types (email then link)"

# Metrics
duration: 4min
completed: 2026-02-05
---

# Phase 2 Plan 1: Projects and Invitations Summary

**Email and shareable link invitation system with Argon2 token hashing, timing-safe verification, and projects CRUD for organization-scoped work**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-05T10:54:39Z
- **Completed:** 2026-02-05T10:59:08Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Projects table with org relationship for project-scoped work
- Email invitations with hashed tokens and 7-day expiry
- Shareable invite links with usage tracking
- Accept flow supporting both invitation types
- Auto-add existing users when invited (sends notification email)
- Timing attack prevention via dummy hash comparison

## Task Commits

Each task was committed atomically:

1. **Task 1: Create projects and invitations schemas** - `2a991a6` (feat)
2. **Task 2: Create invitations service and email** - `31f7ec0` (feat)
3. **Task 3: Create invitation routes and wire to app** - `4203a1a` (feat)

## Files Created/Modified

- `src/shared/db/schema/projects.ts` - Projects table schema
- `src/shared/db/schema/invitations.ts` - Email invitations with token hash
- `src/shared/db/schema/invite-links.ts` - Shareable links with usage count
- `src/features/invitations/invitations.types.ts` - Input/result types
- `src/features/invitations/invitations.email.ts` - Invitation and notification emails
- `src/features/invitations/invitations.service.ts` - Invitation business logic
- `src/features/invitations/invitations.routes.ts` - REST endpoints
- `src/features/projects/` - Complete project CRUD feature
- `src/index.ts` - Mounted invitation and project routes

## Decisions Made

- **Auto-add existing users:** When inviting an email that exists, user is automatically added to org with notification email (per RESEARCH recommendation)
- **Argon2 for token hashing:** Same configuration as auth tokens (memoryCost: 65536, timeCost: 3, parallelism: 4)
- **Timing attack prevention:** Always perform hash comparison even when no matching invitation found

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Invitation system complete and tested
- Projects can be created and listed per organization
- Ready for 02-02 (roles and permissions)
- Schema foundation in place for project membership

---

*Phase: 02-team-access*
*Completed: 2026-02-05*

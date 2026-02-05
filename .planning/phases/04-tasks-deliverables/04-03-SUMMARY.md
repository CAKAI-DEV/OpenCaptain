---
phase: 04-tasks-deliverables
plan: 03
subsystem: api
tags: [dependencies, custom-fields, cycle-detection, dfs, zod, jsonb, validation]

# Dependency graph
requires:
  - phase: 04-tasks-deliverables
    provides: Tasks schema and CRUD (04-01), Deliverable types and deliverables schema (04-02)
  - phase: 02-team-access
    provides: Auth middleware, visibility middleware, projects/users tables
provides:
  - Polymorphic dependencies table for cross-type blocking (task<->deliverable)
  - DFS-based cycle detection preventing circular dependencies
  - Custom field definitions at project level with JSONB config
  - Dynamic Zod validation for 8 field types
  - REST APIs at /api/v1/dependencies and /api/v1/custom-fields
affects: [04-04-metrics, 04-05-file-uploads, agent-implementation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DFS cycle detection for dependency graph validation
    - Polymorphic references via type+id columns (not FK)
    - Dynamic Zod schema building for runtime validation
    - JSONB config with TypeScript interface for type-safe access

key-files:
  created:
    - src/shared/db/schema/dependencies.ts
    - src/shared/db/schema/custom-fields.ts
    - src/features/dependencies/dependencies.service.ts
    - src/features/dependencies/dependencies.routes.ts
    - src/features/dependencies/dependencies.types.ts
    - src/features/dependencies/index.ts
    - src/features/custom-fields/custom-fields.service.ts
    - src/features/custom-fields/custom-fields.routes.ts
    - src/features/custom-fields/custom-fields.types.ts
    - src/features/custom-fields/index.ts
  modified:
    - src/shared/db/schema/index.ts
    - src/index.ts

key-decisions:
  - "Polymorphic dependencies via type+id columns, not foreign keys"
  - "DFS cycle detection at service layer (not database constraint)"
  - "Field type changes prevented after creation (400 error)"
  - "Custom fields can apply to tasks, deliverables, or both"

patterns-established:
  - "wouldCreateCycle(blocker, blocked) for dependency validation"
  - "buildFieldValidator(field) for dynamic Zod schema generation"
  - "isBlocked(node) checks incomplete blockers (task status != done OR deliverable not final)"

# Metrics
duration: 6min
completed: 2026-02-06
---

# Phase 04 Plan 03: Dependencies & Custom Fields Summary

**Cross-type dependency management with DFS cycle detection and project-level custom field definitions with dynamic Zod validation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-05T17:36:26Z
- **Completed:** 2026-02-05T17:42:26Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Polymorphic dependencies table supporting task<->task, task<->deliverable, deliverable<->deliverable blocking
- DFS-based cycle detection that prevents circular dependencies with 400 error
- Custom fields with 8 types: text, number, date, select, multi_select, url, file, relation
- Dynamic Zod validation supporting min/max for numbers, options for selects, and relationTo for relations
- Complete REST APIs with proper error handling and validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create dependencies schema and service** - `b29e10c` (feat)
2. **Task 2: Create custom fields schema and validation service** - `454baec` (feat)
3. **Task 3: Create routes for dependencies and custom fields** - `fc3607e` (feat)

## Files Created/Modified

- `src/shared/db/schema/dependencies.ts` - Polymorphic dependencies table with unique constraint
- `src/shared/db/schema/custom-fields.ts` - Custom field definitions with FieldConfig interface
- `src/features/dependencies/dependencies.service.ts` - DFS cycle detection, CRUD, isBlocked check
- `src/features/dependencies/dependencies.routes.ts` - REST endpoints for dependency management
- `src/features/dependencies/dependencies.types.ts` - DependencyNode, CreateDependencyInput types
- `src/features/custom-fields/custom-fields.service.ts` - buildFieldValidator, validateCustomFieldValues
- `src/features/custom-fields/custom-fields.routes.ts` - REST endpoints with validation
- `src/features/custom-fields/custom-fields.types.ts` - FIELD_TYPES constant, input/output types
- `src/shared/db/schema/index.ts` - Export new schemas
- `src/index.ts` - Wire routes at /api/v1/dependencies and /api/v1/custom-fields

## Decisions Made

- **Polymorphic via type+id:** Dependencies use blockerType/blockerId instead of FKs to support cross-type references
- **DFS at service layer:** Cycle detection via graph traversal allows better error messages than database constraints
- **Type immutability:** Prevent field type changes after creation to avoid data inconsistency
- **Inclusive targeting:** Custom fields can apply to tasks, deliverables, or both via boolean flags

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Zod v4 API change:** `result.error.errors` became `result.error.issues` - fixed during implementation
- **Non-null assertions:** Linter flagged `stack.pop()!` pattern - refactored to explicit undefined check

Both issues were minor and fixed inline during implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dependencies and custom fields infrastructure complete
- Ready for Plan 04 (Metrics) to query completed items
- Ready for Plan 05 (File Uploads) to attach proof files
- isBlocked function ready for UI to show dependency status

---
*Phase: 04-tasks-deliverables*
*Completed: 2026-02-06*

---
phase: "07"
plan: "05"
subsystem: "web-ui"
tags: ["list-view", "filters", "table", "url-params", "search", "debounce"]
dependency-graph:
  requires:
    - phase: "07-03"
      provides: ["dashboard-layout", "project-selector"]
    - phase: "07-04"
      provides: ["optimistic-task-updates", "use-tasks-hook"]
  provides:
    - "task-list-view"
    - "url-persisted-filters"
    - "search-with-debounce"
    - "inline-status-change"
  affects: ["07-06"]
tech-stack:
  added: ["date-fns"]
  patterns: ["URL search params for filter state", "debounced search input", "client-side filtering"]
key-files:
  created:
    - "web/src/app/(dashboard)/projects/[projectId]/list/page.tsx"
    - "web/src/components/list/task-list.tsx"
    - "web/src/components/list/task-row.tsx"
    - "web/src/components/list/task-filters.tsx"
    - "web/src/components/list/search-input.tsx"
    - "web/src/hooks/use-debounced-callback.ts"
    - "web/src/components/ui/table.tsx"
    - "web/src/components/ui/calendar.tsx"
    - "web/src/components/ui/popover.tsx"
    - "web/src/components/ui/checkbox.tsx"
  modified:
    - "web/package.json"
key-decisions:
  - "URL search params for shareable filtered views"
  - "300ms debounce on search input to reduce API calls"
  - "Priority and search filtering done client-side (backend only supports status filter)"
  - "Inline status change via dropdown with optimistic updates"
patterns-established:
  - "useDebouncedCallback hook for debounced operations"
  - "SearchInput component with URL param integration"
  - "TaskFilters component pattern for multi-filter UI"
metrics:
  duration: "3 min"
  completed: "2026-02-06"
---

# Phase 7 Plan 5: Task List View Summary

**Filterable task list with table format, search, status/priority dropdowns, and URL-persisted filter state for shareable views.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-06T10:49:18Z
- **Completed:** 2026-02-06T10:52:23Z
- **Tasks:** 3
- **Files created:** 10

## Accomplishments

- Task list displays in table format with columns: Title, Status, Priority, Due Date, Assignee
- Status filter dropdown updates URL and results
- Priority filter dropdown updates URL and results
- Search input filters by title/description with 300ms debounce
- Filters persist in URL (shareable filtered views)
- Clear button removes all filters
- Status can be changed inline with optimistic update
- Empty state shown when no tasks match filters

## Task Commits

1. **Task 1: Add shadcn/ui components for filters** - `77285b0` (feat)
2. **Task 2: Create task filter components** - `ad686f0` (feat)
3. **Task 3: Create task list and list page** - `f3142d8` (feat)

## Files Created

| File | Purpose |
|------|---------|
| `web/src/app/(dashboard)/projects/[projectId]/list/page.tsx` | List view page reading URL filters |
| `web/src/components/list/task-list.tsx` | Table component with optimistic updates |
| `web/src/components/list/task-row.tsx` | Task row with inline status dropdown |
| `web/src/components/list/task-filters.tsx` | Status/priority dropdowns, clear button |
| `web/src/components/list/search-input.tsx` | Debounced search with URL update |
| `web/src/hooks/use-debounced-callback.ts` | Generic debounce hook |
| `web/src/components/ui/table.tsx` | shadcn/ui table component |
| `web/src/components/ui/calendar.tsx` | shadcn/ui calendar component |
| `web/src/components/ui/popover.tsx` | shadcn/ui popover component |
| `web/src/components/ui/checkbox.tsx` | shadcn/ui checkbox component |

## Technical Details

### Filter State Flow

```
User changes filter
  -> Select/Input onChange
  -> URL searchParams updated
  -> Page re-renders with new searchParams
  -> Server fetches with status filter
  -> Client applies priority/search filter
  -> TaskList displays filtered results
```

### Shareable URLs

Filters are stored in URL search params:
- `?status=in_progress` - Filter by status
- `?priority=high` - Filter by priority
- `?search=deploy` - Search by title/description
- `?status=todo&priority=urgent&search=bug` - Combined filters

### Optimistic Updates

Uses same `useOptimisticTasks` hook from Kanban board:
1. User changes status via dropdown
2. UI updates immediately
3. PATCH request sent in background
4. On failure, React reverts state

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| URL params for filters | useSearchParams | Shareable, bookmarkable, browser back works |
| Debounce delay | 300ms | Balance between responsiveness and API load |
| Client-side priority filter | Filter after fetch | Backend doesn't support priority filter yet |
| Inline status change | Dropdown in row | Quick status updates without modal |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all components created successfully and build passes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- 07-06: Analytics dashboard with charts (already complete per commits)

**List view provides:**
- Alternative view to Kanban for list-oriented users
- Advanced filtering capabilities
- Shareable filtered views via URL
- Foundation for bulk operations (multi-select)

---
*Phase: 07-web-ui-analytics*
*Plan: 05*
*Completed: 2026-02-06*

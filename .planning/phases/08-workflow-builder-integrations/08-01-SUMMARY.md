---
phase: 08-workflow-builder-integrations
plan: 01
subsystem: ui
tags: [react-flow, dagre, workflow-editor, drag-drop, visual-builder]

# Dependency graph
requires:
  - phase: 07-web-ui-analytics
    provides: Next.js dashboard with shadcn/ui components
provides:
  - React Flow visual workflow canvas with custom node types
  - Dagre auto-layout for tree hierarchy positioning
  - Drag-drop block palette with 4 workflow block types
  - Properties panel for node configuration
  - Workflows page at /projects/[projectId]/workflows
affects: [08-02, 08-03, backend-workflow-api]

# Tech tracking
tech-stack:
  added: ["@xyflow/react@12.x", "@dagrejs/dagre@1.x"]
  patterns: ["nodeTypes outside component", "edgesRef for state access in callbacks"]

key-files:
  created:
    - web/src/components/workflow/workflow-canvas.tsx
    - web/src/components/workflow/workflow-editor.tsx
    - web/src/components/workflow/workflow-sidebar.tsx
    - web/src/components/workflow/workflow-properties.tsx
    - web/src/components/workflow/nodes/check-in-node.tsx
    - web/src/components/workflow/nodes/escalation-node.tsx
    - web/src/components/workflow/nodes/role-node.tsx
    - web/src/components/workflow/nodes/visibility-node.tsx
    - web/src/lib/workflow/layout.ts
    - web/src/lib/workflow/types.ts
    - web/src/app/(dashboard)/projects/[projectId]/workflows/page.tsx
  modified:
    - web/src/components/common/sidebar.tsx
    - web/package.json

key-decisions:
  - "nodeTypes defined at module level to prevent React Flow flickering"
  - "edgesRef pattern for accessing current edges in drag callbacks without stale closures"
  - "WorkflowNode uses flexible typing with index signature for React Flow compatibility"
  - "button element for draggable blocks (accessibility compliance)"

patterns-established:
  - "nodeTypes outside component: Define custom node type registry at module level"
  - "useRef + useEffect for mutable references in callbacks"

# Metrics
duration: 9min
completed: 2026-02-06
---

# Phase 8 Plan 1: Visual Workflow Editor Summary

**React Flow canvas with dagre auto-layout, drag-drop block palette, and node properties panel for n8n-style workflow configuration**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-06T13:47:35Z
- **Completed:** 2026-02-06T13:56:18Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Visual workflow canvas with React Flow and custom node types (CheckIn, Escalation, Role, Visibility)
- Dagre auto-layout that positions nodes in tree hierarchy when dropped
- Drag-and-drop from sidebar palette to canvas with correct positioning
- Properties panel for editing node configuration based on type
- Workflows page integrated into project navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Set up React Flow canvas with custom node types** - `07e767f` (feat)
2. **Task 2: Add dagre auto-layout and drag-drop from sidebar** - `cfc54c1` (feat)
3. **Task 3: Create workflows page and integrate editor** - `97035b3` (feat)

## Files Created/Modified
- `web/src/lib/workflow/types.ts` - Workflow node types and data factories
- `web/src/lib/workflow/layout.ts` - Dagre layout utility (getLayoutedElements)
- `web/src/components/workflow/nodes/*.tsx` - Four custom node components
- `web/src/components/workflow/workflow-canvas.tsx` - React Flow canvas wrapper
- `web/src/components/workflow/workflow-sidebar.tsx` - Draggable block palette
- `web/src/components/workflow/workflow-properties.tsx` - Node configuration forms
- `web/src/components/workflow/workflow-editor.tsx` - Parent component combining all parts
- `web/src/app/(dashboard)/projects/[projectId]/workflows/page.tsx` - Workflows page
- `web/src/components/common/sidebar.tsx` - Added Workflows nav link

## Decisions Made
- **nodeTypes at module level:** React Flow re-creates node components if nodeTypes object changes identity. Defining outside component prevents flickering.
- **edgesRef pattern:** Used useRef + useEffect to access current edges in handleDrop callback without adding edges to dependency array (would cause infinite loops).
- **Flexible WorkflowNode type:** Used index signature `[key: string]: unknown` on node data types for React Flow's strict Node type requirements.
- **button for draggable blocks:** Changed from div with role="button" to semantic button element for accessibility compliance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type compatibility with React Flow v12**
- **Found during:** Task 1 (Custom node types)
- **Issue:** React Flow v12 has strict type requirements for Node data - requires Record<string, unknown> compatibility
- **Fix:** Added index signature to all node data types
- **Files modified:** web/src/lib/workflow/types.ts
- **Verification:** Build passes without type errors
- **Committed in:** 07e767f (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed refs access during render error**
- **Found during:** Task 2 (Drag-drop implementation)
- **Issue:** ESLint error - Cannot update ref during render
- **Fix:** Wrapped edgesRef.current assignment in useEffect
- **Files modified:** web/src/components/workflow/workflow-editor.tsx
- **Verification:** Lint passes, no refs-during-render error
- **Committed in:** cfc54c1 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for TypeScript/React compatibility. No scope creep.

## Issues Encountered
None - plan executed with minor type adjustments.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Visual workflow editor complete and functional
- Ready for backend API integration (save/load workflow configuration)
- Canvas supports edges but no edge creation UI yet (future enhancement)

---
*Phase: 08-workflow-builder-integrations*
*Completed: 2026-02-06*

# Phase 4: Tasks & Deliverables - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Core PM data structures: tasks with subtasks, dependencies, and deliverable blocks with custom fields and status flows. Users can create, manage, and track work items. Output metrics per person, squad, and time period. Messaging interfaces and proactive behaviors are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Task structure
- 2 levels of subtask nesting max (Task → Subtask → Sub-subtask, then stop)
- 4 priority levels: Urgent, High, Medium, Low
- Shared field library at project level — custom fields can be applied to tasks OR deliverables
- Fixed task status flow: To Do → In Progress → Done (customization is deliverables-only)

### Dependency model
- Cross-type dependencies allowed (task can block deliverable, deliverable can block task)
- Soft enforcement — show warning when moving blocked item, but allow override
- Strict circular dependency prevention — system refuses to create cycles
- Claude's discretion on dependency type (simple blocks/blocked-by is sufficient for most use cases)

### Deliverable types
- Preset templates included — both generic PM types (Bug, Feature, Task, Epic) and content types (Article, Video, Social Post, Design)
- Admins can customize presets or use as-is
- Custom field types: Text, Number, Date, Select, Multi-select, URL, File attachment, Relation (link to other items)
- Configurable status transitions — admin defines which status-to-status moves are allowed per type

### Metrics & rollups
- Output = completed deliverables + completed tasks
- Time granularity: daily, weekly, and monthly views
- Full charts: counts, velocity trend, burndown (remaining work over time)
- Squad-tagged work — each task/deliverable tagged to a squad, counts toward that squad's metrics

### Claude's Discretion
- Exact dependency type implementation (simple blocks/blocked-by vs finish-to-start)
- Preset template field configurations
- Metrics calculation/caching strategy
- Burndown chart algorithm

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-tasks-deliverables*
*Context gathered: 2026-02-05*

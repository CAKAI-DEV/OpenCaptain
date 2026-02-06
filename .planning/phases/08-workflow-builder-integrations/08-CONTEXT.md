# Phase 8 Context: Workflow Builder & Integrations

**Gathered:** 2026-02-06
**Phase Goal:** Admins can visually configure workflows and sync with Linear

## Gray Areas Resolved

### 1. Visual Editor UX

**Block Types:** Core blocks only
- Check-ins, Escalations, Roles, Visibility blocks
- No custom block type creation (keep simple)
- Configure existing block types visually

**Canvas Style:** Simple tree
- Parent-child hierarchy connections
- Clear flow direction (top-down or left-right)
- No cycles, no arbitrary connections

**Implementation Notes:**
- Use React Flow for canvas (industry standard, good DX)
- Block palette on left, canvas center, properties panel right
- Drag from palette to canvas, click to edit properties
- Save produces JSON that maps to existing block APIs

### 2. Linear Sync Behavior

**Conflict Resolution:** Last-write wins
- Most recent change wins regardless of source
- Track `updatedAt` timestamps from both systems
- Simple, predictable, no queued conflicts

**Sync Fields:** Essential fields only
- Title, description, status, assignee, priority, blockers
- No label/tag sync, no comment sync, no attachments
- Keep sync surface small for reliability

**Implementation Notes:**
- Use Linear webhooks for real-time updates
- Map BlockBot statuses to Linear workflow states
- Blockers sync as Linear issue links (blocks/blocked-by)
- Store Linear issue ID on tasks for correlation

### 3. Coding Agent Scope

**Autonomy Level:** PR only
- Agent creates PR for human review
- Never auto-merges, regardless of test status
- Human approves all changes through normal PR flow

**Repo Access:** Linked repos only
- Admin explicitly links GitHub repos per project
- Agent can only access linked repos
- OAuth flow for GitHub app installation

**Implementation Notes:**
- Use GitHub App for repo access (not PAT)
- Store GitHub installation ID per organization
- Agent spawns Claude Code or similar for actual coding
- PR created with detailed description of what changed and why

### 4. Natural Language Task Creation

**Ambiguity Handling:** Confirm before creating
- Agent parses user intent, shows confirmation
- User can accept, modify, or cancel
- Never create tasks silently

**Auto-detection:** Suggest only
- Agent identifies actionable items in conversation
- Shows suggestions: "I noticed you mentioned X, want me to create a task?"
- User confirms which suggestions to create

**Implementation Notes:**
- Use LLM function calling for intent extraction
- Extract: title, description, assignee hints, due date hints, priority
- Confirmation shows extracted fields with edit capability
- Auto-detection runs on conversation messages, not every user message

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Canvas library | React Flow | Industry standard, TypeScript, good docs |
| Sync direction | Bidirectional | Teams use both systems, need parity |
| Conflict strategy | Last-write wins | Simple, predictable, no queue management |
| Linear API | Webhooks + GraphQL | Real-time updates, flexible queries |
| GitHub integration | GitHub App | Per-org install, granular permissions |
| Coding agent | PR only | Safety, human-in-the-loop always |
| NL confirmation | Always | Prevent accidental task creation |
| Auto-detection | Suggest mode | User control over what gets created |

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| React Flow learning curve | Use official examples, keep interactions simple |
| Linear API rate limits | Cache webhook state, batch updates |
| Sync data loss | Log all sync operations, audit trail |
| Coding agent errors | PR review required, no auto-merge |
| NL misinterpretation | Confirmation flow catches errors |

## Open Questions (for research phase)

1. React Flow node/edge types needed for block representation
2. Linear webhook payload structure for status changes
3. GitHub App permissions required for PR creation
4. Claude Code API or subprocess model for coding agent

## Requirements Covered

- WEB-03: Visual block editor (n8n-style)
- WEB-04: Drag-and-drop block placement
- INTG-01: Bidirectional Linear sync
- INTG-02: Status/assignee/blocker field mapping
- INTG-03: Webhook receiving
- INTG-04: Webhook sending
- AI-04: Smart insights generation
- AI-05: Proactive suggestions
- AI-06: Coding agent authorization
- AI-07: PR creation for review
- TASK-07: NL task creation in chat
- TASK-08: Auto-detect actionable items

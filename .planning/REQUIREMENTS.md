# Requirements: BlockBot

**Defined:** 2026-02-05
**Core Value:** Teams manage work through natural conversation with an AI that understands their project context, while admins configure workflows visually without code.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Task Management

- [x] **TASK-01**: User can create tasks with title, description, assignee, and due date
- [x] **TASK-02**: User can edit and delete tasks they have permission to modify
- [x] **TASK-03**: User can set task priority (low, medium, high, urgent)
- [x] **TASK-04**: Admin can define custom status flows per deliverable type
- [x] **TASK-05**: User can create subtasks under parent tasks
- [x] **TASK-06**: User can define task dependencies (X blocks Y)
- [x] **TASK-07**: User can create tasks via natural language in chat ("create a task to fix the login bug")
- [x] **TASK-08**: Agent automatically detects actionable items in conversation and creates tasks

### Team & Roles

- [x] **TEAM-01**: Admin can invite users to organization via email
- [x] **TEAM-02**: Admin can assign users to projects with specific roles
- [x] **TEAM-03**: Admin can create custom role blocks with configurable capabilities
- [x] **TEAM-04**: Roles support hierarchical reporting structure (Creator → Squad Lead → Op Lead → PM)
- [x] **TEAM-05**: Users can hold multiple roles across different projects
- [x] **TEAM-06**: Admin can create squads and assign squad leads
- [x] **TEAM-07**: Squad leads can view and manage their squad members

### Deliverables

- [x] **DELV-01**: Admin can create deliverable block types with custom fields
- [x] **DELV-02**: Deliverable blocks support field types: text, select, date, number, file, URL
- [x] **DELV-03**: Admin can define status flows per deliverable type (e.g., ideation → production → review → done)
- [x] **DELV-04**: User can upload proof files attached to deliverables
- [x] **DELV-05**: System tracks deliverable metrics (count per person, per squad, per time period)
- [x] **DELV-06**: User can view their deliverable output metrics

### Check-ins & Communication

- [x] **COMM-01**: User can @mention others in comments
- [x] **COMM-02**: User can comment on tasks and deliverables
- [x] **COMM-03**: User receives notifications for mentions, assignments, and updates
- [x] **COMM-04**: User can view activity feed showing recent project activity
- [x] **CHCK-01**: Admin can create check-in blocks with scheduled frequency
- [x] **CHCK-02**: Check-in blocks support custom questions
- [x] **CHCK-03**: Agent sends check-in prompts at scheduled times via messaging channel
- [x] **CHCK-04**: System provides check-in templates (daily standup, output count, weekly forecast)
- [x] **CHCK-05**: Agent generates recap summaries for stakeholders (daily, weekly)
- [x] **CHCK-06**: Recaps are tailored to recipient's role and visibility level

### Escalations

- [x] **ESCL-01**: Admin can create escalation blocks with configurable triggers
- [x] **ESCL-02**: Escalation triggers support: blocker reported, deadline risk, output below threshold
- [x] **ESCL-03**: Escalation blocks support time-windowed routing (e.g., 4hr → squad lead, 24hr → PM)
- [x] **ESCL-04**: User can report blockers via messaging channel
- [x] **ESCL-05**: Squad lead can mark blockers as resolved
- [x] **ESCL-06**: Agent sends deadline risk alerts when deliverable is due soon and not progressed
- [x] **ESCL-07**: Agent sends output threshold warnings when creator output drops below configured level

### Visibility & Access

- [x] **VISB-01**: Admin can create visibility blocks defining access rules
- [x] **VISB-02**: Default visibility is squad-scoped (members see own work, leads see squad)
- [x] **VISB-03**: Admin can grant cross-squad access to specific leads
- [x] **VISB-04**: PM and admin have project-wide visibility
- [x] **VISB-05**: All queries and views respect visibility rules

### Messaging Channels

- [x] **MSG-01**: User can interact with agent via WhatsApp
- [x] **MSG-02**: User can interact with agent via Telegram
- [x] **MSG-03**: Agent understands natural language commands and queries
- [x] **MSG-04**: User can switch between project contexts (/switch command)
- [x] **MSG-05**: Agent remembers last used project context per user
- [x] **MSG-06**: Agent sends proactive messages (check-ins, alerts, recaps)
- [x] **MSG-07**: User can query agent ("what's due this week?", "squad status")

### Web UI

- [x] **WEB-01**: User can log in and access dashboard
- [x] **WEB-02**: Dashboard shows project overview with health indicators
- [x] **WEB-03**: Admin can use visual block editor to configure workflows (n8n-style)
- [x] **WEB-04**: Visual editor supports drag-and-drop block placement
- [x] **WEB-05**: User can view tasks in Kanban board view
- [x] **WEB-06**: User can view tasks in list view with filters and search
- [x] **WEB-07**: User can view individual analytics (their output, trends)
- [x] **WEB-08**: Squad lead can view squad analytics (output, blockers, trends)
- [x] **WEB-09**: PM can view project-level analytics (all squads, health score)

### Integrations

- [x] **INTG-01**: System syncs tasks bidirectionally with Linear
- [x] **INTG-02**: Linear sync maps: status ↔ issue status, assignee ↔ assignee, blockers → comments
- [x] **INTG-03**: System can receive webhooks from external services
- [ ] **INTG-04**: System can send webhooks on configurable events

### AI Agent

- [x] **AI-01**: Agent maintains knowledge of project context, history, and patterns
- [x] **AI-02**: Agent memory persists across conversations
- [x] **AI-03**: Admin can configure which LLM model to use (Claude, GPT, local models)
- [x] **AI-04**: Agent generates smart insights ("Instagram output dropped 30% this week")
- [x] **AI-05**: Agent provides proactive suggestions based on patterns
- [x] **AI-06**: Lead can authorize agent to spawn coding agent for minor bug fixes
- [x] **AI-07**: Coding agent creates PR for review (does not merge automatically)

### Deployment & Self-Hosting

- [x] **DEPLOY-01**: System can be deployed via Docker/Docker Compose
- [x] **DEPLOY-02**: Users provide their own LLM API tokens (BYOT)
- [x] **DEPLOY-03**: System is configured via environment variables
- [x] **DEPLOY-04**: Documentation covers VPS deployment with root access
- [x] **DEPLOY-05**: System runs on minimum 8GB RAM, 4 CPU cores

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Integrations

- **INTG-05**: Google Sheets integration for content tracking
- **INTG-06**: GitHub integration for PR/issue sync
- **INTG-07**: Slack/Discord integration as additional channels

### Advanced Analytics

- **ANLYT-01**: Organization-level analytics (cross-project)
- **ANLYT-02**: Custom dashboard builder
- **ANLYT-03**: Export analytics to CSV/PDF

### Advanced AI

- **AI-08**: Agent learns from user corrections and improves over time
- **AI-09**: Custom AI persona configuration per project
- **AI-10**: Coding agent handles small features (not just bugs)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Time tracking / timesheets | Surveillance-adjacent, conflicts with trust-based culture |
| Employee monitoring | Privacy violation, not aligned with project values |
| Gantt charts | Conflicts with messaging-first approach, adds complexity |
| Native mobile apps | WhatsApp/Telegram ARE the mobile apps |
| Gamification (badges, leaderboards) | Creates toxic competition, not aligned with values |
| Fully autonomous AI execution | Requires human-in-the-loop for safety |
| Video/voice calls | Solved problem, use existing tools |
| SaaS/hosted version | Open-source self-hosted only for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPLOY-01 | Phase 1 | Complete |
| DEPLOY-02 | Phase 1 | Complete |
| DEPLOY-03 | Phase 1 | Complete |
| DEPLOY-04 | Phase 1 | Complete |
| DEPLOY-05 | Phase 1 | Complete |
| TEAM-01 | Phase 2 | Complete |
| TEAM-02 | Phase 2 | Complete |
| TEAM-03 | Phase 2 | Complete |
| TEAM-04 | Phase 2 | Complete |
| TEAM-05 | Phase 2 | Complete |
| TEAM-06 | Phase 2 | Complete |
| TEAM-07 | Phase 2 | Complete |
| VISB-01 | Phase 2 | Complete |
| VISB-02 | Phase 2 | Complete |
| VISB-03 | Phase 2 | Complete |
| VISB-04 | Phase 2 | Complete |
| VISB-05 | Phase 2 | Complete |
| AI-01 | Phase 3 | Complete |
| AI-02 | Phase 3 | Complete |
| AI-03 | Phase 3 | Complete |
| TASK-01 | Phase 4 | Complete |
| TASK-02 | Phase 4 | Complete |
| TASK-03 | Phase 4 | Complete |
| TASK-04 | Phase 4 | Complete |
| TASK-05 | Phase 4 | Complete |
| TASK-06 | Phase 4 | Complete |
| DELV-01 | Phase 4 | Complete |
| DELV-02 | Phase 4 | Complete |
| DELV-03 | Phase 4 | Complete |
| DELV-04 | Phase 4 | Complete |
| DELV-05 | Phase 4 | Complete |
| DELV-06 | Phase 4 | Complete |
| MSG-01 | Phase 5 | Complete |
| MSG-02 | Phase 5 | Complete |
| MSG-03 | Phase 5 | Complete |
| MSG-04 | Phase 5 | Complete |
| MSG-05 | Phase 5 | Complete |
| MSG-06 | Phase 5 | Complete |
| MSG-07 | Phase 5 | Complete |
| COMM-01 | Phase 5 | Complete |
| COMM-02 | Phase 5 | Complete |
| COMM-03 | Phase 5 | Complete |
| COMM-04 | Phase 5 | Complete |
| CHCK-01 | Phase 6 | Complete |
| CHCK-02 | Phase 6 | Complete |
| CHCK-03 | Phase 6 | Complete |
| CHCK-04 | Phase 6 | Complete |
| CHCK-05 | Phase 6 | Complete |
| CHCK-06 | Phase 6 | Complete |
| ESCL-01 | Phase 6 | Complete |
| ESCL-02 | Phase 6 | Complete |
| ESCL-03 | Phase 6 | Complete |
| ESCL-04 | Phase 6 | Complete |
| ESCL-05 | Phase 6 | Complete |
| ESCL-06 | Phase 6 | Complete |
| ESCL-07 | Phase 6 | Complete |
| WEB-01 | Phase 7 | Complete |
| WEB-02 | Phase 7 | Complete |
| WEB-05 | Phase 7 | Complete |
| WEB-06 | Phase 7 | Complete |
| WEB-07 | Phase 7 | Complete |
| WEB-08 | Phase 7 | Complete |
| WEB-09 | Phase 7 | Complete |
| WEB-03 | Phase 8 | Pending |
| WEB-04 | Phase 8 | Pending |
| INTG-01 | Phase 8 | Pending |
| INTG-02 | Phase 8 | Pending |
| INTG-03 | Phase 8 | Pending |
| INTG-04 | Phase 8 | Pending |
| AI-04 | Phase 8 | Pending |
| AI-05 | Phase 8 | Pending |
| AI-06 | Phase 8 | Pending |
| AI-07 | Phase 8 | Pending |
| TASK-07 | Phase 8 | Pending |
| TASK-08 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 75 total
- Mapped to phases: 75
- Unmapped: 0

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after Phase 1 completion*

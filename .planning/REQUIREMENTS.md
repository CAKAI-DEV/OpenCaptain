# Requirements: BlockBot

**Defined:** 2026-02-05
**Core Value:** Teams manage work through natural conversation with an AI that understands their project context, while admins configure workflows visually without code.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Task Management

- [ ] **TASK-01**: User can create tasks with title, description, assignee, and due date
- [ ] **TASK-02**: User can edit and delete tasks they have permission to modify
- [ ] **TASK-03**: User can set task priority (low, medium, high, urgent)
- [ ] **TASK-04**: Admin can define custom status flows per deliverable type
- [ ] **TASK-05**: User can create subtasks under parent tasks
- [ ] **TASK-06**: User can define task dependencies (X blocks Y)
- [ ] **TASK-07**: User can create tasks via natural language in chat ("create a task to fix the login bug")
- [ ] **TASK-08**: Agent automatically detects actionable items in conversation and creates tasks

### Team & Roles

- [ ] **TEAM-01**: Admin can invite users to organization via email
- [ ] **TEAM-02**: Admin can assign users to projects with specific roles
- [ ] **TEAM-03**: Admin can create custom role blocks with configurable capabilities
- [ ] **TEAM-04**: Roles support hierarchical reporting structure (Creator → Squad Lead → Op Lead → PM)
- [ ] **TEAM-05**: Users can hold multiple roles across different projects
- [ ] **TEAM-06**: Admin can create squads and assign squad leads
- [ ] **TEAM-07**: Squad leads can view and manage their squad members

### Deliverables

- [ ] **DELV-01**: Admin can create deliverable block types with custom fields
- [ ] **DELV-02**: Deliverable blocks support field types: text, select, date, number, file, URL
- [ ] **DELV-03**: Admin can define status flows per deliverable type (e.g., ideation → production → review → done)
- [ ] **DELV-04**: User can upload proof files attached to deliverables
- [ ] **DELV-05**: System tracks deliverable metrics (count per person, per squad, per time period)
- [ ] **DELV-06**: User can view their deliverable output metrics

### Check-ins & Communication

- [ ] **COMM-01**: User can @mention others in comments
- [ ] **COMM-02**: User can comment on tasks and deliverables
- [ ] **COMM-03**: User receives notifications for mentions, assignments, and updates
- [ ] **COMM-04**: User can view activity feed showing recent project activity
- [ ] **CHCK-01**: Admin can create check-in blocks with scheduled frequency
- [ ] **CHCK-02**: Check-in blocks support custom questions
- [ ] **CHCK-03**: Agent sends check-in prompts at scheduled times via messaging channel
- [ ] **CHCK-04**: System provides check-in templates (daily standup, output count, weekly forecast)
- [ ] **CHCK-05**: Agent generates recap summaries for stakeholders (daily, weekly)
- [ ] **CHCK-06**: Recaps are tailored to recipient's role and visibility level

### Escalations

- [ ] **ESCL-01**: Admin can create escalation blocks with configurable triggers
- [ ] **ESCL-02**: Escalation triggers support: blocker reported, deadline risk, output below threshold
- [ ] **ESCL-03**: Escalation blocks support time-windowed routing (e.g., 4hr → squad lead, 24hr → PM)
- [ ] **ESCL-04**: User can report blockers via messaging channel
- [ ] **ESCL-05**: Squad lead can mark blockers as resolved
- [ ] **ESCL-06**: Agent sends deadline risk alerts when deliverable is due soon and not progressed
- [ ] **ESCL-07**: Agent sends output threshold warnings when creator output drops below configured level

### Visibility & Access

- [ ] **VISB-01**: Admin can create visibility blocks defining access rules
- [ ] **VISB-02**: Default visibility is squad-scoped (members see own work, leads see squad)
- [ ] **VISB-03**: Admin can grant cross-squad access to specific leads
- [ ] **VISB-04**: PM and admin have project-wide visibility
- [ ] **VISB-05**: All queries and views respect visibility rules

### Messaging Channels

- [ ] **MSG-01**: User can interact with agent via WhatsApp
- [ ] **MSG-02**: User can interact with agent via Telegram
- [ ] **MSG-03**: Agent understands natural language commands and queries
- [ ] **MSG-04**: User can switch between project contexts (/switch command)
- [ ] **MSG-05**: Agent remembers last used project context per user
- [ ] **MSG-06**: Agent sends proactive messages (check-ins, alerts, recaps)
- [ ] **MSG-07**: User can query agent ("what's due this week?", "squad status")

### Web UI

- [ ] **WEB-01**: User can log in and access dashboard
- [ ] **WEB-02**: Dashboard shows project overview with health indicators
- [ ] **WEB-03**: Admin can use visual block editor to configure workflows (n8n-style)
- [ ] **WEB-04**: Visual editor supports drag-and-drop block placement
- [ ] **WEB-05**: User can view tasks in Kanban board view
- [ ] **WEB-06**: User can view tasks in list view with filters and search
- [ ] **WEB-07**: User can view individual analytics (their output, trends)
- [ ] **WEB-08**: Squad lead can view squad analytics (output, blockers, trends)
- [ ] **WEB-09**: PM can view project-level analytics (all squads, health score)

### Integrations

- [ ] **INTG-01**: System syncs tasks bidirectionally with Linear
- [ ] **INTG-02**: Linear sync maps: status ↔ issue status, assignee ↔ assignee, blockers → comments
- [ ] **INTG-03**: System can receive webhooks from external services
- [ ] **INTG-04**: System can send webhooks on configurable events

### AI Agent

- [ ] **AI-01**: Agent maintains knowledge of project context, history, and patterns
- [ ] **AI-02**: Agent memory persists across conversations
- [ ] **AI-03**: Admin can configure which LLM model to use (Claude, GPT, local models)
- [ ] **AI-04**: Agent generates smart insights ("Instagram output dropped 30% this week")
- [ ] **AI-05**: Agent provides proactive suggestions based on patterns
- [ ] **AI-06**: Lead can authorize agent to spawn coding agent for minor bug fixes
- [ ] **AI-07**: Coding agent creates PR for review (does not merge automatically)

### Deployment & Self-Hosting

- [ ] **DEPLOY-01**: System can be deployed via Docker/Docker Compose
- [ ] **DEPLOY-02**: Users provide their own LLM API tokens (BYOT)
- [ ] **DEPLOY-03**: System is configured via environment variables
- [ ] **DEPLOY-04**: Documentation covers VPS deployment with root access
- [ ] **DEPLOY-05**: System runs on minimum 8GB RAM, 4 CPU cores

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
| DEPLOY-01 | Phase 1 | Pending |
| DEPLOY-02 | Phase 1 | Pending |
| DEPLOY-03 | Phase 1 | Pending |
| DEPLOY-04 | Phase 1 | Pending |
| DEPLOY-05 | Phase 1 | Pending |
| TEAM-01 | Phase 2 | Pending |
| TEAM-02 | Phase 2 | Pending |
| TEAM-03 | Phase 2 | Pending |
| TEAM-04 | Phase 2 | Pending |
| TEAM-05 | Phase 2 | Pending |
| TEAM-06 | Phase 2 | Pending |
| TEAM-07 | Phase 2 | Pending |
| VISB-01 | Phase 2 | Pending |
| VISB-02 | Phase 2 | Pending |
| VISB-03 | Phase 2 | Pending |
| VISB-04 | Phase 2 | Pending |
| VISB-05 | Phase 2 | Pending |
| AI-01 | Phase 3 | Pending |
| AI-02 | Phase 3 | Pending |
| AI-03 | Phase 3 | Pending |
| TASK-01 | Phase 4 | Pending |
| TASK-02 | Phase 4 | Pending |
| TASK-03 | Phase 4 | Pending |
| TASK-04 | Phase 4 | Pending |
| TASK-05 | Phase 4 | Pending |
| TASK-06 | Phase 4 | Pending |
| DELV-01 | Phase 4 | Pending |
| DELV-02 | Phase 4 | Pending |
| DELV-03 | Phase 4 | Pending |
| DELV-04 | Phase 4 | Pending |
| DELV-05 | Phase 4 | Pending |
| DELV-06 | Phase 4 | Pending |
| MSG-01 | Phase 5 | Pending |
| MSG-02 | Phase 5 | Pending |
| MSG-03 | Phase 5 | Pending |
| MSG-04 | Phase 5 | Pending |
| MSG-05 | Phase 5 | Pending |
| MSG-06 | Phase 5 | Pending |
| MSG-07 | Phase 5 | Pending |
| COMM-01 | Phase 5 | Pending |
| COMM-02 | Phase 5 | Pending |
| COMM-03 | Phase 5 | Pending |
| COMM-04 | Phase 5 | Pending |
| CHCK-01 | Phase 6 | Pending |
| CHCK-02 | Phase 6 | Pending |
| CHCK-03 | Phase 6 | Pending |
| CHCK-04 | Phase 6 | Pending |
| CHCK-05 | Phase 6 | Pending |
| CHCK-06 | Phase 6 | Pending |
| ESCL-01 | Phase 6 | Pending |
| ESCL-02 | Phase 6 | Pending |
| ESCL-03 | Phase 6 | Pending |
| ESCL-04 | Phase 6 | Pending |
| ESCL-05 | Phase 6 | Pending |
| ESCL-06 | Phase 6 | Pending |
| ESCL-07 | Phase 6 | Pending |
| WEB-01 | Phase 7 | Pending |
| WEB-02 | Phase 7 | Pending |
| WEB-05 | Phase 7 | Pending |
| WEB-06 | Phase 7 | Pending |
| WEB-07 | Phase 7 | Pending |
| WEB-08 | Phase 7 | Pending |
| WEB-09 | Phase 7 | Pending |
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
*Last updated: 2026-02-05 after roadmap creation*

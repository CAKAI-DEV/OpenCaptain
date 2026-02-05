# Roadmap: BlockBot

## Overview

BlockBot is a self-hosted project management agent built on a building blocks architecture. The roadmap progresses from core infrastructure through team management, AI capabilities, messaging interfaces, proactive behaviors, web UI, and culminates with the visual workflow builder and integrations. Each phase delivers a coherent, testable capability that builds toward the core value: teams managing work through natural conversation with an AI that understands their project context.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Infrastructure** - Database, auth, API gateway, deployment foundation ✓
- [x] **Phase 2: Team & Access** - Users, organizations, roles, squads, visibility rules ✓
- [ ] **Phase 3: LLM Infrastructure** - Model abstraction, memory persistence, RAG pipeline
- [ ] **Phase 4: Tasks & Deliverables** - Core PM data structures and CRUD operations
- [ ] **Phase 5: Messaging Channels** - WhatsApp and Telegram bot interfaces
- [ ] **Phase 6: Check-ins & Escalations** - Scheduled prompts, alerts, and escalation chains
- [ ] **Phase 7: Web UI & Analytics** - Dashboard, task views, analytics at all levels
- [ ] **Phase 8: Workflow Builder & Integrations** - Visual block editor, Linear sync, advanced AI

## Phase Details

### Phase 1: Core Infrastructure
**Goal**: System can be deployed and accessed with basic authentication
**Depends on**: Nothing (first phase)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05
**Success Criteria** (what must be TRUE):
  1. System deploys via Docker Compose on a fresh VPS with documented steps
  2. User can configure LLM API tokens via environment variables
  3. System runs stable on minimum specs (8GB RAM, 4 CPU cores)
  4. API endpoints respond with proper authentication/rejection
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md - Database, cache, and project foundation (PostgreSQL, Redis, Drizzle ORM)
- [x] 01-02-PLAN.md - JWT authentication with password login and magic links
- [x] 01-03-PLAN.md - Rate limiting, health checks, Docker deployment, documentation

### Phase 2: Team & Access
**Goal**: Admins can create organizations, invite users, assign roles, and configure visibility
**Depends on**: Phase 1
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05, TEAM-06, TEAM-07, VISB-01, VISB-02, VISB-03, VISB-04, VISB-05
**Success Criteria** (what must be TRUE):
  1. Admin can invite users to organization and they receive email invitations
  2. Admin can create role blocks with hierarchical reporting structure
  3. Admin can create squads and assign squad leads who see their members
  4. Users can hold multiple roles across different projects
  5. All data queries respect visibility rules (squad-scoped by default, cross-squad by grant)
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md - Projects, invitations (email + shareable links), accept flow
- [x] 02-02-PLAN.md - Role hierarchy, squads, squad membership with 1-level nesting
- [x] 02-03-PLAN.md - Visibility grants, CASL abilities, middleware enforcement

### Phase 3: LLM Infrastructure
**Goal**: Agent has persistent memory and can use swappable LLM models
**Depends on**: Phase 1
**Requirements**: AI-01, AI-02, AI-03
**Success Criteria** (what must be TRUE):
  1. Admin can configure which LLM model to use (Claude, GPT, local models via LiteLLM)
  2. Agent maintains knowledge of project context and history across conversations
  3. Agent memory persists across sessions (episodic and semantic memory working)
**Plans**: TBD

Plans:
- [ ] 03-01: LiteLLM proxy and model abstraction
- [ ] 03-02: Vector database and RAG pipeline
- [ ] 03-03: Memory manager (working, episodic, semantic, procedural)

### Phase 4: Tasks & Deliverables
**Goal**: Users can create, manage, and track tasks and deliverables
**Depends on**: Phase 2
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, DELV-01, DELV-02, DELV-03, DELV-04, DELV-05, DELV-06
**Success Criteria** (what must be TRUE):
  1. User can create tasks with title, description, assignee, due date, priority, and subtasks
  2. User can define task dependencies (X blocks Y) and see blocked status
  3. Admin can create deliverable blocks with custom fields (text, select, date, number, file, URL)
  4. Admin can define custom status flows per deliverable type
  5. User can view their deliverable output metrics (count per person, per squad, per time period)
**Plans**: TBD

Plans:
- [ ] 04-01: Task data model and CRUD operations
- [ ] 04-02: Deliverable blocks and custom fields
- [ ] 04-03: Status flows and metrics tracking

### Phase 5: Messaging Channels
**Goal**: Users can interact with agent via WhatsApp and Telegram
**Depends on**: Phase 3, Phase 4
**Requirements**: MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, MSG-06, MSG-07, COMM-01, COMM-02, COMM-03, COMM-04
**Success Criteria** (what must be TRUE):
  1. User can send messages to agent via Telegram and receive contextual responses
  2. User can send messages to agent via WhatsApp and receive contextual responses
  3. Agent understands natural language queries ("what's due this week?", "squad status")
  4. User can switch project contexts and agent remembers last used project per user
  5. User can @mention others, comment on tasks, and receive notifications for relevant activity
**Plans**: TBD

Plans:
- [ ] 05-01: Telegram bot with grammY
- [ ] 05-02: WhatsApp Business API integration
- [ ] 05-03: Natural language understanding and context management
- [ ] 05-04: Comments, mentions, and notifications

### Phase 6: Check-ins & Escalations
**Goal**: Agent proactively reaches out for check-ins and handles escalations
**Depends on**: Phase 5
**Requirements**: CHCK-01, CHCK-02, CHCK-03, CHCK-04, CHCK-05, CHCK-06, ESCL-01, ESCL-02, ESCL-03, ESCL-04, ESCL-05, ESCL-06, ESCL-07
**Success Criteria** (what must be TRUE):
  1. Admin can create check-in blocks with scheduled frequency and custom questions
  2. Agent sends check-in prompts at scheduled times via messaging channel
  3. Agent generates recap summaries tailored to recipient's role and visibility level
  4. Admin can create escalation blocks with configurable triggers (blocker, deadline risk, low output)
  5. Escalations route through time-windowed chains (e.g., 4hr to squad lead, 24hr to PM)
**Plans**: TBD

Plans:
- [ ] 06-01: Check-in blocks and scheduling
- [ ] 06-02: Recap generation and distribution
- [ ] 06-03: Escalation blocks and routing chains

### Phase 7: Web UI & Analytics
**Goal**: Users can access dashboard, task views, and analytics via web interface
**Depends on**: Phase 4, Phase 6
**Requirements**: WEB-01, WEB-02, WEB-05, WEB-06, WEB-07, WEB-08, WEB-09
**Success Criteria** (what must be TRUE):
  1. User can log in and see project dashboard with health indicators
  2. User can view tasks in Kanban board view with drag-and-drop
  3. User can view tasks in list view with filters and search
  4. User can view their individual analytics (output, trends)
  5. Squad lead and PM can view squad-level and project-level analytics respectively
**Plans**: TBD

Plans:
- [ ] 07-01: Authentication and dashboard
- [ ] 07-02: Task views (Kanban, list, filters)
- [ ] 07-03: Analytics dashboards (individual, squad, project)

### Phase 8: Workflow Builder & Integrations
**Goal**: Admins can visually configure workflows and sync with Linear
**Depends on**: Phase 6, Phase 7
**Requirements**: WEB-03, WEB-04, INTG-01, INTG-02, INTG-03, INTG-04, AI-04, AI-05, AI-06, AI-07, TASK-07, TASK-08
**Success Criteria** (what must be TRUE):
  1. Admin can use visual block editor (n8n-style drag-and-drop) to configure workflows
  2. System syncs tasks bidirectionally with Linear (status, assignee, blockers)
  3. Agent generates smart insights ("Instagram output dropped 30% this week")
  4. Agent provides proactive suggestions based on patterns
  5. User can create tasks via natural language in chat and agent auto-detects actionable items
  6. Lead can authorize agent to spawn coding agent for minor bug fixes (PR created for review)
**Plans**: TBD

Plans:
- [ ] 08-01: Visual workflow editor (React Flow)
- [ ] 08-02: Linear integration (bidirectional sync)
- [ ] 08-03: Smart insights and proactive suggestions
- [ ] 08-04: Natural language task creation and auto-detection
- [ ] 08-05: Coding agent integration

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Infrastructure | 3/3 | Complete | 2026-02-05 |
| 2. Team & Access | 3/3 | Complete | 2026-02-05 |
| 3. LLM Infrastructure | 0/3 | Not started | - |
| 4. Tasks & Deliverables | 0/3 | Not started | - |
| 5. Messaging Channels | 0/4 | Not started | - |
| 6. Check-ins & Escalations | 0/3 | Not started | - |
| 7. Web UI & Analytics | 0/3 | Not started | - |
| 8. Workflow Builder & Integrations | 0/5 | Not started | - |

---
*Roadmap created: 2026-02-05*
*Total requirements: 75 | Phases: 8 | Depth: Comprehensive*

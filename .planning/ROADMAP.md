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
- [x] **Phase 3: LLM Infrastructure** - Model abstraction, memory persistence, RAG pipeline ✓
- [x] **Phase 4: Tasks & Deliverables** - Core PM data structures and CRUD operations ✓
- [x] **Phase 5: Messaging Channels** - WhatsApp and Telegram bot interfaces ✓
- [x] **Phase 6: Check-ins & Escalations** - Scheduled prompts, alerts, and escalation chains ✓
- [x] **Phase 7: Web UI & Analytics** - Dashboard, task views, analytics at all levels ✓
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
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md - Projects, invitations (email + shareable links), accept flow
- [x] 02-02-PLAN.md - Role hierarchy, squads, squad membership with 1-level nesting
- [x] 02-03-PLAN.md - Visibility grants, CASL abilities, middleware enforcement
- [x] 02-04-PLAN.md - Gap closure: Apply visibility middleware to data routes (VISB-05)

### Phase 3: LLM Infrastructure
**Goal**: Agent has persistent memory and can use swappable LLM models
**Depends on**: Phase 1
**Requirements**: AI-01, AI-02, AI-03
**Success Criteria** (what must be TRUE):
  1. Admin can configure which LLM model to use (Claude, GPT, local models via LiteLLM)
  2. Agent maintains knowledge of project context and history across conversations
  3. Agent memory persists across sessions (episodic and semantic memory working)
**Plans**: 5 plans (3 original + 2 gap closure)

Plans:
- [x] 03-01-PLAN.md - LiteLLM proxy setup, OpenAI SDK client, organization model preference
- [x] 03-02-PLAN.md - pgvector extension, embeddings schema, RAG pipeline with visibility
- [x] 03-03-PLAN.md - Conversation storage, hierarchical memory, BullMQ consolidation worker
- [x] 03-04-PLAN.md - Gap closure: Conversations service + routes wiring RAG/memory/LLM
- [x] 03-05-PLAN.md - Gap closure: Explicit pgvector extension migration

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
**Plans**: 4 plans

Plans:
- [x] 04-01-PLAN.md - Tasks schema with 2-level nesting, priority, and CRUD endpoints
- [x] 04-02-PLAN.md - Deliverable types with status flows, preset templates, and deliverables CRUD
- [x] 04-03-PLAN.md - Cross-type dependencies with cycle detection, custom field definitions
- [x] 04-04-PLAN.md - S3 file uploads with presigned URLs, output metrics and burndown

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
**Plans**: 7 plans

Plans:
- [x] 05-01-PLAN.md - Database schemas (user_messaging, comments, notifications)
- [x] 05-02-PLAN.md - Telegram bot with grammY and Redis sessions
- [x] 05-03-PLAN.md - WhatsApp Cloud API integration
- [x] 05-04-PLAN.md - Comments with @mention parsing
- [x] 05-05-PLAN.md - Notifications system with messaging delivery
- [x] 05-06-PLAN.md - Intent detection and context management
- [x] 05-07-PLAN.md - Proactive messaging and activity feed

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
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md - Check-in blocks, templates, scheduling, and delivery worker
- [x] 06-02-PLAN.md - Role-based recap generation with LLM and scheduled delivery
- [x] 06-03-PLAN.md - Escalation blocks, blockers, routing chains, deadline/output monitoring

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
**Plans**: 6 plans

Plans:
- [x] 07-01-PLAN.md - Next.js project setup with Tailwind 4 and shadcn/ui foundation
- [x] 07-02-PLAN.md - Auth integration with JWT cookies, middleware, login/magic-link pages
- [x] 07-03-PLAN.md - Dashboard layout, sidebar, header, project selector, health cards
- [x] 07-04-PLAN.md - Kanban board with dnd-kit drag-and-drop and optimistic updates
- [x] 07-05-PLAN.md - Task list view with filters, search, and URL-persisted state
- [x] 07-06-PLAN.md - Analytics dashboards with Recharts (velocity, burndown, output)

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
| 2. Team & Access | 4/4 | Complete | 2026-02-05 |
| 3. LLM Infrastructure | 5/5 | Complete | 2026-02-05 |
| 4. Tasks & Deliverables | 4/4 | Complete | 2026-02-06 |
| 5. Messaging Channels | 7/7 | Complete | 2026-02-06 |
| 6. Check-ins & Escalations | 3/3 | Complete | 2026-02-06 |
| 7. Web UI & Analytics | 6/6 | Complete | 2026-02-06 |
| 8. Workflow Builder & Integrations | 0/5 | Not started | - |

---
*Roadmap created: 2026-02-05*
*Total requirements: 75 | Phases: 8 | Depth: Comprehensive*

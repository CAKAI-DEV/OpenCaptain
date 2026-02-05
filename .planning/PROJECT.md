# BlockBot

## What This Is

An open-source, self-hosted project management agent built on a building blocks architecture. Teams assemble their workflow from reusable blocks (roles, deliverables, check-ins, escalations, visibility rules, integrations) rather than conforming to rigid templates. The agent communicates via WhatsApp and Telegram, acting as an actual PM — proactively reaching out, responding to queries, maintaining project knowledge, and optionally spawning coding agents to fix minor bugs.

## Core Value

Teams manage work through natural conversation with an AI that understands their project context, while admins configure workflows visually without code.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Visual block editor (n8n-style drag-and-drop) for workflow configuration
- [ ] WhatsApp integration as primary messaging channel
- [ ] Telegram integration as secondary channel
- [ ] Full LLM-powered agent with swappable model support (Claude, GPT, local models)
- [ ] Multi-project support with per-person multi-role assignments
- [ ] Role blocks with hierarchical permissions (Creator → Squad Lead → Op Lead → PM)
- [ ] Deliverable blocks with custom fields and status flows
- [ ] Check-in blocks with scheduled prompts (daily standup, output count, recaps)
- [ ] Escalation blocks with time-windowed chains and auto-routing
- [ ] Visibility blocks controlling who sees what (squad-scoped, cross-squad, project-wide)
- [ ] Linear integration for dev task sync (bidirectional)
- [ ] Project knowledge/memory — agent understands context and history
- [ ] Automatic task creation when agent detects actionable items in conversation
- [ ] Recaps and summaries generated for relevant stakeholders
- [ ] Analytics dashboards in web UI (individual, squad, project, org levels)
- [ ] Coding agent integration — leads can trigger Claude Code/Codex to fix minor bugs and create PRs
- [ ] Self-hosted deployment on VPS with root access
- [ ] Bring-your-own-token model for LLM costs

### Out of Scope

- SaaS/hosted version — this is open-source self-hosted only
- Google Sheets integration — web UI handles content tracking
- Mobile app — web + messaging channels are sufficient
- Video/voice calls — text-based communication only
- Payment processing — not a billing platform

## Context

**First users:** Internal dev team and marketing team. Multi-project is required from day one because teams are already split across projects.

**Building blocks philosophy:** Everything is composable. Instead of "here's how our PM tool works," it's "assemble your workflow from these pieces." Six block types:
1. Role Block — capabilities, reporting structure, check-in type
2. Deliverable Block — fields, status flow, metrics
3. Check-in Block — frequency, questions, applies-to roles
4. Escalation Block — triggers, time windows, routing chain
5. Visibility Block — who sees what, scope rules
6. Integration Block — external tool connections

**Agent behavior:**
- Proactive: scheduled check-ins, deadline reminders, escalation notifications, recaps
- Reactive: answers queries, handles submissions, processes approvals
- Smart: maintains project knowledge, creates tasks from conversation, generates insights
- Orchestrator: can spawn coding agents when authorized by leads

**Example flows from concept doc:**
- Marketing team: Content creators submit pieces, squad leads approve, daily output check-ins, weekly recaps
- Dev team: Tasks sync with Linear, daily standups, blocker escalation chains, PR stale alerts

## Constraints

- **Messaging platforms**: WhatsApp (primary) + Telegram only for v1
- **Self-hosted**: Must run on user's own VPS with root access
- **BYOT**: Users provide their own LLM API tokens
- **Linear required**: Dev team workflow depends on Linear sync
- **Open source**: Code must be publicly available, community can contribute

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| n8n-style visual editor over config files | Non-technical admins need to configure workflows | — Pending |
| WhatsApp + Telegram only (not all platforms) | Focus on what's actually used, WhatsApp is primary | — Pending |
| Full LLM agent over structured flows | Natural conversation is core to the PM experience | — Pending |
| Coding agent spawning (lead-authorized only) | Enable automation of minor fixes without autonomous risk | — Pending |
| Linear integration required for v1 | Dev team lives in Linear, sync is non-negotiable | — Pending |

---
*Last updated: 2026-02-05 after initialization*

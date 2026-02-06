# OpenMinion

**Your AI Project Manager That Actually Manages**

OpenMinion is a self-hosted, open-source project management agent that communicates through WhatsApp and Telegram. Unlike traditional PM tools where you check dashboards, OpenMinion proactively reaches out, conducts check-ins, escalates blockers, and keeps your projects moving—all through natural conversation.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.0+-black)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Why OpenMinion?

Traditional PM tools are passive—they wait for you to update them. OpenMinion is different:

- **Proactive**: Sends daily standups, deadline reminders, and escalation alerts
- **Conversational**: Manage tasks through WhatsApp/Telegram, not another dashboard
- **Context-Aware**: Remembers project history and understands your team's workflow
- **Composable**: Build your workflow from modular blocks, not rigid templates
- **Self-Hosted**: Your data stays on your infrastructure. Bring your own LLM tokens.

---

## Features

### Conversational Project Management
- Natural language task creation: *"Add task: Fix login bug, assign to @john, due Friday"*
- Query your projects: *"What's overdue?"*, *"Show Sarah's tasks"*
- Update status through chat: *"Mark #123 as done"*

### Building Blocks Architecture
Assemble your workflow from six composable block types:

| Block | Purpose |
|-------|---------|
| **Role** | Define team structure, permissions, reporting lines |
| **Deliverable** | Custom fields, status flows, task types |
| **Check-in** | Scheduled prompts (standups, output counts, mood) |
| **Escalation** | Time-based chains, auto-routing, fallback approvers |
| **Visibility** | Squad-scoped, cross-squad, or project-wide access |
| **Integration** | Connect Linear, GitHub, and external tools |

### AI-Powered Intelligence
- **Memory**: Maintains project knowledge across conversations
- **Auto-Detection**: Creates tasks when it spots actionable items
- **Summarization**: Generates recaps for stakeholders
- **BYOT**: Bring your own tokens for Claude, GPT, or local models

### Team Collaboration
- Multi-project support with per-person role assignments
- Hierarchical roles: Creator → Squad Lead → Op Lead → PM
- Squad-scoped visibility for sensitive projects
- Activity feed and notifications

### Integrations
- **WhatsApp** (primary channel)
- **Telegram** (secondary channel)
- **Linear** (bidirectional task sync)
- **GitHub** (PR/issue tracking)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh) |
| Framework | [Hono](https://hono.dev) |
| Database | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Vector Store | pgvector (for RAG/memory) |
| Queue | [BullMQ](https://bullmq.io) + Redis |
| LLM | OpenAI, Anthropic Claude, or local models |
| Auth | JWT + Argon2 |
| Validation | Zod |
| Docs | OpenAPI 3.1 + Swagger UI |

---

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) 1.0+
- PostgreSQL 15+ (with pgvector extension)
- Redis 7+
- LLM API key (OpenAI, Anthropic, or compatible)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/openminion.git
cd openminion

# Install dependencies
bun install

# Copy environment template
cp .env.example .env

# Configure your environment (see Configuration below)
nano .env

# Start services
docker-compose up -d

# Run database migrations
bun run db:migrate

# Start the server
bun run dev
```

### Configuration

Create a `.env` file with:

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgres://user:password@localhost:5432/openminion

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# LLM (choose one or more)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Messaging
WHATSAPP_VERIFY_TOKEN=your-webhook-verify-token
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Email (for invitations)
RESEND_API_KEY=re_...

# Optional
CORS_ORIGIN=http://localhost:3000
LINEAR_API_KEY=lin_api_...
```

---

## Usage

### Via Messaging (WhatsApp/Telegram)

Once connected, your team interacts naturally:

```
You: What's on my plate today?

OpenMinion: Good morning! Here's your day:

  Due Today:
  • Fix auth redirect bug (#142) - High priority
  • Review Sarah's PR for payment flow

  Upcoming:
  • API documentation update - Due tomorrow

  You have standup in 2 hours. Want me to remind you?
```

```
You: Create task: Update landing page copy, assign to @marketing, due next Monday

OpenMinion: Created task #156: "Update landing page copy"
  • Assigned to: Marketing Team
  • Due: Monday, Feb 10
  • Priority: Normal

  Should I add any details or subtasks?
```

### Via API

Full REST API available at `/api/v1`:

```bash
# Create a task
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix login bug",
    "assigneeId": "user_123",
    "dueDate": "2026-02-10",
    "priority": "high"
  }'
```

API documentation: `http://localhost:3000/docs`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Messaging Channels                       │
│                  (WhatsApp, Telegram, API)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                      Hono API Layer                          │
│              (Routes, Middleware, Validation)                │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Feature Modules                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │  Tasks   │ │  Teams   │ │  Roles   │ │Check-ins │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │Visibility│ │Escalation│ │  Recaps  │ │  Memory  │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                      LLM Layer                               │
│            (RAG, Conversations, Summarization)               │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Infrastructure                            │
│         PostgreSQL + pgvector │ Redis │ BullMQ              │
└─────────────────────────────────────────────────────────────┘
```

---

## Commands

```bash
# Development
bun run dev              # Start with hot reload
bun run start            # Production start
bun run build            # Build for production

# Database
bun run db:generate      # Generate migrations
bun run db:migrate       # Run migrations
bun run db:studio        # Open Drizzle Studio

# Quality
bun run typecheck        # TypeScript check
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
bun run format           # Format code
bun run check            # Full check (lint + format)

# Testing
bun run test             # All tests
bun run test:unit        # Unit tests only
bun run test:integration # Integration tests only
bun run test:coverage    # With coverage report
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login with email/password |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Revoke all refresh tokens |
| POST | `/api/v1/auth/magic-link/request` | Request magic link |
| GET | `/api/v1/auth/magic-link/verify` | Verify magic link |

### Teams & Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/teams` | Create team |
| GET | `/api/v1/teams` | List user's teams |
| POST | `/api/v1/projects` | Create project |
| GET | `/api/v1/projects` | List projects |

### Tasks & Deliverables
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tasks` | Create task |
| GET | `/api/v1/tasks` | List tasks |
| PATCH | `/api/v1/tasks/:id` | Update task |
| DELETE | `/api/v1/tasks/:id` | Delete task |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/conversations` | Start conversation |
| POST | `/api/v1/conversations/:id/messages` | Send message |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/webhooks/telegram` | Telegram updates |
| POST | `/api/v1/webhooks/whatsapp` | WhatsApp updates |

Full documentation at `http://localhost:3000/docs`

---

## Roadmap

- [x] Core infrastructure (auth, teams, roles)
- [x] Team access & visibility controls
- [x] LLM infrastructure (RAG, memory, conversations)
- [x] Tasks & deliverables system
- [x] Messaging channels (WhatsApp, Telegram)
- [x] Check-ins & escalations
- [x] Web UI & analytics dashboard
- [x] Workflow builder & integrations
- [ ] Block marketplace
- [ ] Custom block creation tools
- [ ] Mobile PWA optimization
- [ ] Plugin system for community extensions

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Areas where we'd love help:
- New integration blocks (Slack, Discord, Notion)
- UI/UX improvements for the web dashboard
- Documentation and tutorials
- Translations
- Bug fixes and performance improvements

---

## Self-Hosting

OpenMinion is designed for self-hosting. Recommended specs:

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage | 20 GB SSD | 50 GB SSD |
| Database | PostgreSQL 15 | PostgreSQL 16 |

### Docker Deployment

```bash
docker-compose up -d
```

### Manual Deployment

1. Install Bun, PostgreSQL, Redis on your VPS
2. Clone repo and configure `.env`
3. Run migrations: `bun run db:migrate`
4. Start with process manager: `pm2 start bun -- run start`
5. Configure reverse proxy (nginx/caddy)

---

## Philosophy

### What We Build

- Composable, modular systems
- Conversation-first interfaces
- Self-hosted, privacy-respecting software
- AI that suggests, humans confirm

### What We Don't Build

- Time tracking / surveillance features
- Complex Gantt charts (integrate if needed)
- Native mobile apps (messaging apps are the interface)
- Autonomous AI without human approval
- Gamification that breeds toxic competition

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built with inspiration from:
- [n8n](https://n8n.io) - Visual workflow philosophy
- [Plane](https://plane.so) - Open-source PM approach
- [Linear](https://linear.app) - Developer-first UX
- [DailyBot](https://dailybot.com) - Conversational standups

---

<p align="center">
  <b>OpenMinion</b> — Let the AI handle the meetings, you handle the work.
</p>

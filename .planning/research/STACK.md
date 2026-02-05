# BlockBot Technology Stack Research

> **Research Date:** February 2026
> **Project:** BlockBot - Self-hosted PM Agent Platform
> **Scope:** Full-stack recommendations for AI agent platform with visual workflow editor and messaging integrations

---

## Executive Summary

This document outlines the recommended technology stack for building BlockBot, a self-hosted project management agent platform. The stack prioritizes **production stability**, **ecosystem maturity**, and **flexibility for AI workloads** while maintaining reasonable development velocity.

**Primary Stack:** TypeScript/Node.js backend + Next.js frontend + PostgreSQL + BullMQ + LiteLLM

---

## 1. Backend Runtime

### Recommendation: Node.js 22 LTS with TypeScript

**Confidence Level:** HIGH (95%)

| Aspect | Details |
|--------|---------|
| Version | Node.js 22.x LTS |
| Language | TypeScript 5.4+ |
| Why | Battle-tested for real-time messaging, excellent WebSocket support, unified language with frontend |

#### Rationale

- **40-60% faster** in handling concurrent connections than Python due to non-blocking I/O
- Native WebSocket support ideal for WhatsApp/Telegram real-time messaging
- Unified TypeScript codebase reduces context-switching between frontend and backend
- Netflix uses Node.js and reports **50-60% improvement** in startup times
- Official SDKs available for both WhatsApp and Telegram (Telegraf, grammY)
- Linear's official SDK is TypeScript-first

#### Considerations

- Python has stronger ML/AI library ecosystem, but LiteLLM abstracts this away
- For heavy ML workloads, consider Python microservices alongside Node.js

### What NOT to Use

| Runtime | Why Avoid |
|---------|-----------|
| **Python (as primary)** | GIL limits concurrency; slower for real-time WebSocket workloads. Better as secondary for ML-specific services |
| **Bun** | 2-3x faster benchmarks, but in real-world DB/API workloads "no performance boost." Node.js's decade of stability wins for production |
| **Deno** | Smaller ecosystem, npm compatibility still maturing. Good for edge functions but not full backend |
| **Go** | Excellent performance but loses TypeScript ecosystem benefits; smaller AI/LLM library support |

---

## 2. Web Framework (UI)

### Recommendation: Next.js 15.5+

**Confidence Level:** HIGH (90%)

| Aspect | Details |
|--------|---------|
| Version | Next.js 15.5+ |
| Styling | Tailwind CSS 4.x + shadcn/ui |
| State | Zustand 5.x |

#### Rationale

- **React 19 support** out of the box
- **Turbopack** production-ready (10x faster than Webpack)
- **Server Actions** eliminate need for separate API routes for simple operations
- React Flow (for visual editor) is React-native
- Used by companies like Stripe, Vercel, and thousands of production apps
- App Router provides excellent DX for complex UIs

#### Key Features for BlockBot

```
- Server Components for dashboard performance
- Route Handlers for webhook endpoints
- Middleware for auth in messaging callbacks
- Static generation for documentation/help pages
```

### What NOT to Use

| Framework | Why Avoid |
|-----------|-----------|
| **Create React App** | Deprecated, no active development |
| **Remix** | Good framework but smaller ecosystem than Next.js; less community momentum |
| **Vue/Nuxt** | Excellent but loses React Flow for visual editor; smaller talent pool |
| **SvelteKit** | Great DX but xyflow has React Flow more mature than Svelte Flow |

---

## 3. Visual Workflow Editor

### Recommendation: React Flow + Custom Implementation

**Confidence Level:** MEDIUM-HIGH (80%)

| Aspect | Details |
|--------|---------|
| Library | React Flow 12.x (by xyflow) |
| Template | Start from React Flow UI Workflow Editor template |
| Layout Engine | ELKjs for auto-layout |

#### Rationale

- **Used by Stripe and Typeform** for production workflow tools
- Highly customizable node types for agent blocks
- Active maintenance with professional team in Berlin
- Native React integration (no wrappers)
- Workflow Editor template provides: auto-layout, drag-and-drop sidebar, Zustand state management, runner functionality

#### Build vs Buy Analysis

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **React Flow (Build Custom)** | Full control, custom node types, no vendor lock-in | Development time (2-4 weeks base) | **RECOMMENDED** |
| **n8n (Embed)** | Full-featured, community nodes | Heavy, complex embedding, AGPL license concerns | Consider for v2 |
| **Flowise** | AI-focused, good RAG support | Less flexible for PM workflows | Not ideal |

#### Implementation Notes

```typescript
// Custom block types needed:
- TriggerBlock (WhatsApp message, scheduled, webhook)
- ConditionBlock (if/else logic)
- AgentBlock (LLM call with tools)
- ActionBlock (Linear API, notify, escalate)
- MemoryBlock (store/retrieve context)
```

### What NOT to Use

| Tool | Why Avoid |
|------|-----------|
| **Embedding full n8n** | AGPL license requires open-sourcing modifications; heavyweight for just the editor |
| **Node-RED** | More IoT-focused; dated UI doesn't match modern web standards |
| **Custom from scratch** | 3-6 month development time; React Flow gives 90% of the way there |

---

## 4. Database

### Recommendation: PostgreSQL 17 + pgvector

**Confidence Level:** HIGH (95%)

| Aspect | Details |
|--------|---------|
| Version | PostgreSQL 17.3+ |
| Vector Extension | pgvector 0.8.1 |
| ORM | Drizzle ORM or Prisma 6.x |

#### Rationale

- **Single database** for both relational data AND vector embeddings
- pgvector 0.8.0+ has **iterative index scans** preventing overfiltering
- 40-60% lower TCO compared to separate vector DB solutions
- Battle-tested ACID compliance for project management data
- JSON/JSONB for flexible agent memory storage
- Excellent with Supabase for hosted option if needed

#### Schema Strategy

```sql
-- Project data: normalized tables
-- Agent memory: JSONB columns for flexibility
-- Vector search: pgvector for semantic memory
-- Audit logs: append-only tables with timestamps
```

#### Why Not Separate Vector DB

- Pinecone/Weaviate add operational complexity
- pgvector performance is sufficient for agent memory workloads
- Single connection pool, single backup strategy

### What NOT to Use

| Database | Why Avoid |
|----------|-----------|
| **MongoDB** | Document model less ideal for PM relational data (projects->tasks->subtasks); write-focused when we're read-heavy |
| **SQLite** | Lacks concurrent write support needed for multi-user agent platform |
| **Separate Pinecone/Weaviate** | Unnecessary complexity when pgvector handles both use cases |
| **Supabase (for self-hosted)** | Good for rapid dev, but adds complexity for true self-hosted; consider plain Postgres |

---

## 5. Message Queue / Job Scheduling

### Recommendation: BullMQ

**Confidence Level:** HIGH (85%)

| Aspect | Details |
|--------|---------|
| Library | BullMQ 5.x |
| Backend | Redis 7.x |
| Dashboard | Bull Board or Arena |

#### Rationale

- **Native TypeScript support** with excellent typing
- Parent-child job relationships with unlimited nesting (perfect for agent sub-tasks)
- Exponential backoff retries built-in
- Powers "video transcoding, AI pipelines, payment processing" at scale
- Simpler than Temporal for our use case
- Redis is already needed for session management

#### Use Cases in BlockBot

```typescript
// Queue jobs for:
- LLM inference (rate limiting, retries)
- WhatsApp/Telegram message sending (batching)
- Scheduled check-ins (cron-like)
- Coding agent spawning (long-running)
- Linear API sync (background)
```

#### Why Not Temporal

- Temporal is more powerful but **overkill** for BlockBot's complexity level
- Higher operational overhead (separate Temporal server)
- BullMQ's parent-child jobs handle our hierarchy needs

### What NOT to Use

| Queue | Why Avoid |
|-------|-----------|
| **Temporal** | Overengineered for this use case; requires separate server infrastructure |
| **Inngest** | Cloud-first pricing model; self-hosted option less mature |
| **RabbitMQ** | More complex than needed; BullMQ's Redis-backed simplicity wins |
| **Celery** | Python-only; loses Node.js ecosystem benefits |
| **node-cron** | No persistence, no retries, no distributed support |

---

## 6. Messaging Platform SDKs

### WhatsApp

**Confidence Level:** HIGH (90%)

| Aspect | Details |
|--------|---------|
| SDK | Official `@whatsapp/cloud-api` or `whatsapp-business` |
| Alternative | Twilio WhatsApp API (simpler, more expensive) |

#### Official SDK Features

- TypeScript types included via `typegram`
- Webhook handling for incoming messages
- Template message support required by WhatsApp Business
- Media handling (images, documents)

#### Consideration: Meta Business Verification

WhatsApp Business API requires Meta business verification - plan 2-4 weeks for approval process.

### Telegram

**Confidence Level:** HIGH (90%)

| Aspect | Details |
|--------|---------|
| Primary | grammY 1.x |
| Alternative | Telegraf 4.x |

#### Why grammY over Telegraf

- More active development in 2025/2026
- Better TypeScript support
- Smaller bundle size
- Plugin ecosystem growing faster

#### Shared Architecture

```typescript
// Abstract messaging layer:
interface MessageProvider {
  sendMessage(userId: string, content: MessageContent): Promise<void>
  onMessage(handler: MessageHandler): void
  getConversationHistory(userId: string): Promise<Message[]>
}

// Implementations:
class WhatsAppProvider implements MessageProvider { }
class TelegramProvider implements MessageProvider { }
```

### What NOT to Use

| SDK | Why Avoid |
|-----|-----------|
| **node-telegram-bot-api** | Less maintained than grammY; missing modern features |
| **WhatsApp Web scraping** | Against ToS, unstable, no business features |
| **Third-party aggregators (most)** | Added cost, vendor lock-in; official SDKs are sufficient |

---

## 7. LLM Abstraction Layer

### Recommendation: LiteLLM

**Confidence Level:** HIGH (90%)

| Aspect | Details |
|--------|---------|
| Library | LiteLLM 1.x (Python SDK + Proxy Server) |
| Deployment | Self-hosted proxy server |
| Providers | OpenAI, Anthropic, local Ollama, Azure, etc. |

#### Rationale

- **100+ LLM providers** through single OpenAI-compatible interface
- **Swap models by config, not code** (e.g., `gpt-4o` -> `claude-3-5`)
- Self-hosted proxy server for cost tracking, rate limiting, caching
- Built-in guardrails and logging
- RBAC for multi-tenant setups
- Largest community among LLM gateways

#### Architecture

```
[BlockBot Backend]
       |
       v
[LiteLLM Proxy Server] --> OpenAI API
       |               --> Anthropic API
       |               --> Local Ollama
       |               --> Azure OpenAI
       v
[Cost tracking, caching, fallbacks]
```

#### Key Configuration

```yaml
# litellm_config.yaml
model_list:
  - model_name: "default"
    litellm_params:
      model: "gpt-4o"
      api_key: "os.environ/OPENAI_API_KEY"
  - model_name: "default"  # Fallback
    litellm_params:
      model: "claude-3-5-sonnet"
      api_key: "os.environ/ANTHROPIC_API_KEY"
  - model_name: "local"
    litellm_params:
      model: "ollama/llama3"
      api_base: "http://localhost:11434"
```

### Agent Framework Layer

**On top of LiteLLM, use:**

| Framework | Purpose | Confidence |
|-----------|---------|------------|
| **LangChain.js** | Agent orchestration, tool calling | HIGH (85%) |
| **LangGraph.js** | Complex multi-step workflows | MEDIUM-HIGH (75%) |

#### Why Not Just LangChain

LiteLLM provides the **model abstraction** (swap providers), while LangChain provides the **agent abstraction** (tools, memory, chains). Both are needed.

### What NOT to Use

| Tool | Why Avoid |
|------|-----------|
| **Direct API calls** | No fallbacks, no cost tracking, provider lock-in |
| **LlamaIndex (as primary)** | Better for RAG than agent orchestration; use alongside LangChain if heavy RAG needed |
| **AutoGen** | More complex multi-agent focus; overkill for PM bot |
| **CrewAI** | Python-only; good for pure multi-agent but we need tighter Node.js integration |

---

## 8. External Integrations

### Linear API

**Confidence Level:** HIGH (90%)

| Aspect | Details |
|--------|---------|
| SDK | `@linear/sdk` (official TypeScript SDK) |
| API Type | GraphQL |
| Auth | OAuth 2.0 or API Key |

#### Capabilities

- Create/update/query issues
- Manage projects and cycles
- Webhook subscriptions for real-time updates
- Full TypeScript types

#### Integration Pattern

```typescript
import { LinearClient } from "@linear/sdk";

const linear = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

// Agent tool definition for LangChain
const createIssueTool = {
  name: "create_linear_issue",
  description: "Create a new issue in Linear",
  parameters: { title: "string", description: "string", teamId: "string" },
  execute: async (params) => {
    return await linear.createIssue(params);
  }
};
```

---

## 9. Deployment Architecture

### Recommendation: Docker Compose for VPS

**Confidence Level:** HIGH (85%)

#### Stack Components

```yaml
# docker-compose.yml structure
services:
  app:           # Next.js + API
  worker:        # BullMQ job processor
  litellm:       # LLM proxy server
  postgres:      # Database + pgvector
  redis:         # Queue backend + sessions
  ollama:        # Optional local LLM (if GPU available)
```

#### VPS Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8 cores |
| RAM | 8GB | 16GB (32GB with local LLM) |
| Storage | 50GB SSD | 100GB NVMe |
| GPU | Optional | NVIDIA with 16GB+ VRAM for local LLMs |

#### Self-Hosted LLM Option

If running local models via Ollama:

- **Qwen 2.5 Coder 32B (Q4_K_M)**: Fits in 24GB VRAM, excellent for coding tasks
- **Llama 3 70B**: Needs 48GB+ VRAM, GPT-4 base level quality
- **Smaller models**: Mistral 7B, Llama 3 8B for basic tasks

### What NOT to Use

| Approach | Why Avoid |
|----------|-----------|
| **Kubernetes (initially)** | Overkill for single-VPS deployment; adds complexity without benefit |
| **Serverless (Vercel/Lambda)** | Long-running agent tasks don't fit serverless model; cold starts hurt UX |
| **Managed Kubernetes (EKS/GKE)** | Cost prohibitive for self-hosted goal; defeats purpose |

---

## 10. Complete Stack Summary

### Production Stack

```
Frontend:        Next.js 15.5 + React 19 + Tailwind + shadcn/ui
Visual Editor:   React Flow 12.x + ELKjs
Backend:         Node.js 22 LTS + TypeScript 5.4+
Database:        PostgreSQL 17 + pgvector 0.8.1
Cache/Queue:     Redis 7 + BullMQ 5.x
LLM Gateway:     LiteLLM Proxy (self-hosted)
Agent Framework: LangChain.js + LangGraph.js
WhatsApp:        Official Cloud API SDK
Telegram:        grammY 1.x
Linear:          @linear/sdk
Deployment:      Docker Compose on VPS
```

### Development Tools

```
Package Manager: pnpm 9.x (faster than npm, better monorepo support)
Monorepo:        Turborepo (if splitting packages)
Testing:         Vitest + Playwright
Linting:         Biome (faster than ESLint+Prettier)
```

---

## 11. Confidence Level Summary

| Component | Recommendation | Confidence | Risk |
|-----------|----------------|------------|------|
| Runtime | Node.js 22 + TypeScript | 95% | Low |
| Web Framework | Next.js 15.5 | 90% | Low |
| Visual Editor | React Flow | 80% | Medium |
| Database | PostgreSQL + pgvector | 95% | Low |
| Queue | BullMQ | 85% | Low |
| WhatsApp SDK | Official Cloud API | 90% | Low |
| Telegram SDK | grammY | 90% | Low |
| LLM Gateway | LiteLLM | 90% | Low |
| Agent Framework | LangChain.js | 85% | Low-Medium |
| Deployment | Docker Compose | 85% | Low |

---

## 12. Migration Path / Future Considerations

### Phase 1 (MVP)
- Single Next.js app with API routes
- PostgreSQL with basic tables
- BullMQ for background jobs
- LiteLLM with OpenAI/Anthropic
- Telegram integration only (faster to develop)

### Phase 2 (Beta)
- Add WhatsApp Business integration
- React Flow visual editor
- Linear integration
- pgvector for semantic memory

### Phase 3 (Production)
- Split into services if needed
- Add Ollama for local LLM option
- Advanced workflow features
- Multi-tenant support

---

## Sources

### AI Agent Frameworks
- [Top 8 LLM Frameworks for Building AI Agents in 2026](https://www.secondtalent.com/resources/top-llm-frameworks-for-building-ai-agents/)
- [Top 9 AI Agent Frameworks - Shakudo](https://www.shakudo.io/blog/top-9-ai-agent-frameworks)
- [Top 5 Open-Source Agentic AI Frameworks](https://research.aimultiple.com/agentic-frameworks/)
- [The AI Agent Tech Stack in 2025 - Netguru](https://www.netguru.com/blog/ai-agent-tech-stack)

### LLM Abstraction
- [LiteLLM Documentation](https://docs.litellm.ai/docs/)
- [LiteLLM GitHub](https://github.com/BerriAI/litellm)
- [LlamaIndex vs LangChain Comparison - IBM](https://www.ibm.com/think/topics/llamaindex-vs-langchain)
- [LangChain vs LangGraph vs LlamaIndex](https://xenoss.io/blog/langchain-langgraph-llamaindex-llm-frameworks)

### Visual Editors
- [React Flow](https://reactflow.dev)
- [React Flow Workflow Editor Template](https://reactflow.dev/ui/templates/workflow-editor)
- [n8n Alternatives 2025](https://latenode.com/blog/platform-comparisons-alternatives/n8n-alternatives/n8n-alternatives-2025-12-open-source-self-hosted-workflow-automation-tools-compared)

### Messaging SDKs
- [WhatsApp Node.js SDK](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/)
- [grammY Telegram Framework](https://grammy.dev/)
- [Telegraf GitHub](https://github.com/telegraf/telegraf)
- [Telegram Bot API Library Examples](https://core.telegram.org/bots/samples)

### Database
- [PostgreSQL as Vector Database - Airbyte](https://airbyte.com/data-engineering-resources/postgresql-as-a-vector-database)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [MongoDB AI Agents Documentation](https://www.mongodb.com/docs/atlas/atlas-vector-search/ai-agents/)

### Job Queues
- [BullMQ](https://bullmq.io/)
- [Inngest vs Temporal Comparison](https://akka.io/blog/inngest-vs-temporal)
- [Modern Queueing Architectures](https://medium.com/@pranavprakash4777/modern-queueing-architectures-celery-rabbitmq-redis-or-temporal-f93ea7c526ec)

### Runtime Comparisons
- [Node.js vs Python Backend 2025 - Mobilunity](https://mobilunity.com/blog/node-js-vs-python/)
- [Bun vs Node.js 2025 - Strapi](https://strapi.io/blog/bun-vs-nodejs-performance-comparison-guide)
- [Backend 2025: Node.js vs Python vs Go vs Java](https://talent500.com/blog/backend-2025-nodejs-python-go-java-comparison/)

### Next.js
- [Next.js 15 Blog](https://nextjs.org/blog/next-15)
- [Next.js 15.5 Release Notes](https://nextjs.org/blog/next-15-5)

### Linear API
- [Linear API Documentation](https://linear.app/docs/api-and-webhooks)
- [Linear SDK GitHub](https://github.com/linear/linear)

---

*Last Updated: February 2026*

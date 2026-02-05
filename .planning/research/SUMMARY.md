# BlockBot Project Research Summary

**Project:** BlockBot - Self-hosted PM Agent Platform
**Domain:** AI Agent Platform for Project Management
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

BlockBot is a self-hosted project management agent platform with a unique positioning: conversational-first interaction through WhatsApp/Telegram, a modular block-based architecture for building workflows, and AI-powered autonomous capabilities. Based on comprehensive research across 40+ sources, the recommended approach combines battle-tested technologies (Node.js, Next.js, PostgreSQL) with modern AI infrastructure (LiteLLM, LangChain.js) and a visual workflow builder inspired by n8n.

The market opportunity is significant - the AI for project management market is projected to reach $52.62B by 2030, yet no competitor combines self-hosted deployment, conversational-first UX, modular/composable architecture, AI enhancement, and visual workflow building. The technical approach is validated: Node.js excels at real-time messaging workloads (40-60% faster than Python for concurrent connections), PostgreSQL with pgvector provides unified storage for both relational and vector data (40-60% lower TCO than separate databases), and BullMQ handles complex agent task hierarchies with parent-child job relationships.

The critical risks center on three areas: (1) WhatsApp Business API complexity - template approval can take weeks, and new accounts start with only 250 conversations/24 hours, (2) AI agent reliability - production agents require extensive guardrails against hallucination, prompt injection, and cost overruns (output tokens cost 3-10x input tokens), and (3) architectural pitfalls - building monolithic "god agents" leads to confusion and degraded performance; the solution is specialized multi-agent orchestration with clear boundaries. Mitigation requires starting small, implementing event-driven architecture from day one, and treating agent identities as high-risk with strict sandboxing and audit trails.

## Key Findings

### Recommended Stack

The recommended stack prioritizes production stability and ecosystem maturity over bleeding-edge performance. Node.js 22 LTS with TypeScript provides the runtime, Next.js 15.5 handles both the admin UI and API, PostgreSQL 17 with pgvector serves as the unified database, BullMQ manages background jobs and agent task queues, and LiteLLM provides provider-agnostic LLM access. This combination supports 100+ LLM providers through a single interface, enables swapping models by configuration rather than code, and scales horizontally when needed.

**Core technologies:**
- **Node.js 22 LTS + TypeScript 5.4+**: Runtime and language — unified codebase with frontend, excellent WebSocket support for messaging, non-blocking I/O ideal for concurrent agent operations
- **Next.js 15.5 + React 19**: Web framework and UI — Turbopack production-ready (10x faster), server actions eliminate separate API routes, React Flow integration for visual editor
- **PostgreSQL 17 + pgvector 0.8.1**: Database and vector storage — single database for relational data AND embeddings (40-60% lower TCO), ACID compliance for PM data, iterative index scans prevent over-filtering
- **BullMQ 5.x + Redis 7**: Job queue and cache — native TypeScript support, parent-child job relationships for agent sub-tasks, exponential backoff retries built-in
- **LiteLLM Proxy**: LLM abstraction layer — swap between OpenAI/Anthropic/local models by config, cost tracking per tenant, fallback logic and rate limiting
- **React Flow 12.x**: Visual workflow editor — used by Stripe and Typeform, custom node types for agent blocks, workflow editor template provides auto-layout and runner
- **grammY 1.x**: Telegram bot framework — more active than Telegraf, better TypeScript support, smaller bundle size
- **Official WhatsApp Cloud API**: WhatsApp integration — TypeScript types included, webhook handling, template message support

See [STACK.md](STACK.md) for detailed rationale and version-specific recommendations.

### Expected Features

BlockBot's feature set divides into table stakes (baseline expectations), differentiators (competitive advantages), and anti-features (deliberately not building). The market research reveals that while 80% of enterprise workplace applications now embed AI agents, users remain cautious due to trust and transparency concerns.

**Must have (table stakes):**
- **Task management core** (create/edit/delete tasks, assignments, due dates, status tracking, subtasks, priorities) — every PM tool from Trello to Monday.com has these; users won't adopt without basic task tracking
- **Team communication** (@mentions, comments on tasks, notifications, activity feed) — Slack/Teams integration is expected; conversational PM makes this even more critical
- **Views & organization** (list view, Kanban board, filters/search, labels/tags) — multiple views accommodate different working styles; Kanban is industry standard
- **Basic permissions** (user roles, project access control, invite management) — security and organization are fundamental even in free tools
- **Mobile/messaging access** (WhatsApp bot, Telegram bot, quick actions, natural language input) — this IS BlockBot's primary interface and must work flawlessly

**Should have (competitive advantages):**
- **Building blocks architecture** — composable blocks, block marketplace, custom block creation, block templates; unique to BlockBot, no major competitor offers this modularity (similar philosophy to n8n nodes but for PM functionality)
- **Self-hosted & open source** — full self-hosting, data sovereignty, no per-user pricing, community contributions; competes with Plane and OpenProject, key differentiator from Monday/Asana (SaaS-only)
- **Conversational-first interface** — natural language commands, contextual responses, proactive notifications, multi-channel sync; most PM tools add messaging as afterthought, BlockBot is messaging-native
- **Visual workflow builder** — n8n-style editor, trigger configuration, conditional logic, template library; PM-specific automation reduces complexity vs general automation tools
- **AI-powered automation** — smart task suggestions, risk prediction, auto-summarization, workload balancing; differentiates via self-hosted AI (privacy) and block-based customization

**Defer to v2+ (not essential for launch):**
- Advanced escalation system, multi-project portfolio view, complex resource capacity planning — these are enterprise features that add complexity without being required for initial product-market fit

**Anti-features (deliberately NOT building):**
- Time tracking/timesheets, employee monitoring, complex Gantt charts, native mobile apps (WhatsApp/Telegram ARE the mobile apps), gamification (badges/leaderboards), fully autonomous AI execution without approval — these either conflict with trust-based culture, add unnecessary complexity, or introduce unacceptable risk

See [FEATURES.md](FEATURES.md) for complete feature matrix with complexity ratings and dependencies.

### Architecture Approach

The architecture follows a layered design with clear separation of concerns: presentation layer (web UI + messaging adapters), API gateway (auth + routing), orchestration layer (workflow engine + agent orchestrator), intelligence layer (LLM abstraction + memory manager + RAG pipeline), integration layer (Linear, GitHub, external tools), and data layer (PostgreSQL + Redis + vector DB). This structure supports both the visual workflow builder (admin interface) and autonomous agent execution (user interface).

**Major components:**

1. **Agent Orchestrator** — implements CrewAI-inspired multi-agent patterns with a primary PM agent that routes to specialized sub-agents (research, analysis, execution, coding); uses ReAct loop (Think-Act-Observe) for decision-making; prevents infinite nesting by restricting subagents from spawning other subagents

2. **Memory Manager** — maintains four types of memory: working memory (ephemeral conversation state in Redis), episodic memory (past interactions and decisions in PostgreSQL + vector DB), semantic memory (project knowledge and documentation in vector DB with hybrid search), and procedural memory (learned workflows and procedures as block definitions)

3. **Messaging Adapters** — abstract WhatsApp and Telegram behind a unified MessageProvider interface; handle webhook receipt, signature validation, async processing via Redis queue, conversation context loading, and rate limiting (WhatsApp: 250-100K conversations/24hr tiers; Telegram: 1 msg/sec individual, 20 msg/min groups)

4. **Workflow Engine** — executes block-based workflows with Temporal-style durability; supports trigger blocks (WhatsApp message, scheduled, webhook), condition blocks (if/else logic), agent blocks (LLM calls with tools), action blocks (Linear API, notifications, escalations), and memory blocks (store/retrieve context)

5. **RAG Pipeline** — ingestion phase parses documents/code/conversations, chunks intelligently at semantic boundaries, generates embeddings (text-embedding-3-small), and indexes with metadata; retrieval phase uses hybrid search (dense + sparse vectors), reciprocal rank fusion for combining scores, cross-encoder reranking, and context assembly with source citations

6. **Multi-Tenancy Layer** — uses schema-per-tenant model in PostgreSQL (shared database, tenant-specific schemas), collection-per-tenant in vector DB for strict isolation, key prefixing in Redis (org_id:project_id:resource:id), and RBAC with four roles (Owner/Admin/Member/Viewer) controlling project settings, agent config, workflows, and integrations

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed component diagrams, data flows, and scaling considerations.

### Critical Pitfalls

Research into AI agent failures, open source project post-mortems, and messaging API gotchas reveals ten critical mistakes that consistently sink similar projects. The top five present existential risks if not addressed from the start.

1. **Building monolithic "God Agent"** — creating a single agent handling all tasks (PM, coding, communication) dilutes model attention and causes hallucinations; prevention: use specialized multi-agent system with orchestrator routing to narrow-scope sub-agents; warning signs: increasing hallucinations as features added, agent "forgetting" earlier context, degraded performance on previously working tasks

2. **Polling instead of event-driven architecture** — using request-response polling wastes 95% of API calls, burns rate limits, prevents real-time responsiveness; prevention: webhooks for all integrations (Linear, WhatsApp, Telegram), proper event queuing (Redis, RabbitMQ), push-based updates from start; Linear explicitly discourages polling and may rate-limit violators

3. **Vector database as universal memory dump** — dumping all data into vector DB without structure, schemas, or decay mechanisms leads to "context-flooding" with irrelevant information; prevention: implement proper schemas and metadata, add memory decay for outdated information, separate semantic memory (facts) from episodic memory (interactions), actively manage vectors by removing/replacing when information changes

4. **Underestimating self-hosted infrastructure requirements** — assuming dev specs (2GB RAM, 2 CPU) work for production; prevention: plan for minimum 8GB RAM, 4 CPU cores, PostgreSQL (not SQLite), queue mode with workers for horizontal scaling, budget $300-500/month for infrastructure plus 10-20 hours/month DevOps overhead

5. **Not treating AI agents as high-risk identities** — treating coding agents like harmless chatbots rather than powerful engineer accounts; prevention: apply least-privilege access, implement rate limits on agent actions, log and monitor all operations, use sandboxing for code execution (gVisor, Firecracker), review agent actions periodically; the biggest AI failures of 2025 were organizational (weak controls, unclear ownership) not technical

**Additional critical pitfalls:**

6. **WhatsApp template approval delays** — templates can take days to weeks for approval, business verification has no fixed timeline, Meta is stricter about category enforcement (utility vs marketing); prevention: start approval process weeks before launch, complete business verification immediately, keep templates clear and non-promotional

7. **Output tokens cost 3-10x more than input tokens** — budgeting based on input prices leads to 9x actual costs; prevention: budget for output tokens, set max_tokens limits, use batch API (50% discount) for acceptable 24-hour turnaround, implement prompt caching (90% discount on cache hits)

8. **No agent action transparency** — black box agents breed distrust; "Trust is the true obstacle, not talent or software"; prevention: show agent reasoning and decision chains, provide audit logs, allow previewing actions before execution, implement "explain this decision" functionality

9. **Uncontrolled multi-agent spawning** — allowing unlimited sub-agent spawning or parallel instances; prevention: subagents cannot spawn other subagents (prevents infinite nesting), set hard limits on concurrent instances, implement cost budgets per operation, monitor spawning patterns

10. **Missing retry logic and error handling** — assuming API calls succeed without implementing retries; prevention: exponential backoff for all external calls, circuit breakers for failing services, idempotent workflow design (safe to retry), handle 429 rate limit errors by respecting retry_after headers

See [PITFALLS.md](PITFALLS.md) for complete analysis with warning signs and prevention strategies.

## Implications for Roadmap

Based on research findings, BlockBot should be built in six phases over 14-20 weeks, with clear MVP path at 8-10 weeks. The phase structure follows dependency analysis from architecture research and addresses table stakes features before differentiators.

### Phase 1: Core Infrastructure (Weeks 1-2)
**Rationale:** All other components depend on data layer and basic auth. PostgreSQL schema design and Redis setup enable parallel development in later phases.

**Delivers:** Database migrations and models, Redis cache and pub/sub layer, S3-compatible object storage, JWT/OAuth2 authentication system, basic tenant management with multi-tenancy schema, API gateway with REST/GraphQL endpoints

**Stack elements:** PostgreSQL 17 + pgvector, Redis 7, Node.js 22 + TypeScript, Next.js 15.5

**Avoids:** "Underestimating infrastructure requirements" — starting with production-ready specs (8GB RAM, 4 CPU cores, PostgreSQL not SQLite)

### Phase 2: LLM Infrastructure (Weeks 3-4)
**Rationale:** Agent capabilities require LLM abstraction, vector storage, and RAG pipeline. Building this before agent logic allows testing with simple queries and establishing cost controls.

**Delivers:** LiteLLM proxy server (self-hosted), provider-agnostic interface supporting OpenAI/Anthropic/local models, Qdrant or Pinecone vector DB deployment, RAG ingestion pipeline (chunking, embedding, indexing), RAG retrieval pipeline (hybrid search, reranking, context assembly), cost tracking per tenant, token usage monitoring

**Stack elements:** LiteLLM, Qdrant/Pinecone, text-embedding-3-small

**Avoids:** "Output token cost surprise" — implementing monitoring and max_tokens limits from start; "Vector database as memory dump" — structured ingestion with schemas and metadata

**Research flag:** May need `/gsd:research-phase` for vector DB selection (Qdrant vs Pinecone vs pgvector-only) based on expected scale and budget constraints

### Phase 3: Agent Core (Weeks 5-8)
**Rationale:** Core agent orchestration enables both conversational interaction and workflow execution. Memory management is essential for context retention across conversations.

**Delivers:** Memory manager implementing four memory types (working/episodic/semantic/procedural), agent orchestrator with ReAct loop (Think-Act-Observe), multi-agent routing to specialized sub-agents, tool framework for extensible capabilities, basic agent tools (task creation, status updates, project queries), subagent spawning controls (no infinite nesting), audit logging for all agent actions

**Stack elements:** LangChain.js, LangGraph.js, BullMQ for agent task queues

**Implements:** Agent Orchestrator and Memory Manager from ARCHITECTURE.md

**Avoids:** "Building monolithic God Agent" — implementing multi-agent architecture with specialized sub-agents from start; "Not treating agents as high-risk identities" — audit logging and rate limits built-in; "No learning or memory accumulation" — proper memory persistence and feedback loops

**Research flag:** May need `/gsd:research-phase` for agent framework selection (LangChain.js vs alternatives) and tool interface design

### Phase 4: Messaging Interfaces (Weeks 9-11)
**Rationale:** Messaging channels are BlockBot's primary interface. Telegram is faster to develop (no template approval), making it ideal for MVP. WhatsApp follows after patterns are established.

**Delivers:** Telegram bot with grammY framework, webhook handling with signature validation, async message processing via BullMQ queue, conversation state management, natural language command parsing, rate limiting (1 msg/sec individual, 20 msg/min groups), WhatsApp Business API integration (if templates approved), WhatsApp webhook handling with HMAC-SHA256 validation, conversation-based rate limiting (250-100K tier management), unified MessageProvider abstraction

**Stack elements:** grammY 1.x, Official WhatsApp Cloud API, BullMQ for message queues

**Implements:** Messaging Adapters from ARCHITECTURE.md

**Addresses:** Table stakes feature "Mobile/messaging access" — WhatsApp bot, Telegram bot, quick actions, natural language input

**Avoids:** "WhatsApp template approval delays" — starting approval process immediately, having Telegram as fallback; "Flexible rate limits" — conservative rate limiting well under theoretical limits; "Polling instead of webhooks" — event-driven design with immediate webhook ACK and async processing

**Research flag:** Needs `/gsd:research-phase` for WhatsApp Business API setup specifics (template approval process, business verification timeline, pricing tiers)

### Phase 5: Web UI & Basic PM (Weeks 12-14)
**Rationale:** Admin interface enables workflow configuration and project management. Starting with basic UI and simple chat validates agent interactions before adding visual workflow complexity.

**Delivers:** Next.js web dashboard with authentication, basic chat interface for agent interaction, task management UI (create, edit, delete, assign, status), Kanban board view with drag-and-drop, list view with filters and search, team management (invite, roles, permissions), project settings and configuration, notification preferences

**Stack elements:** Next.js 15.5, React 19, Tailwind CSS 4.x, shadcn/ui components, Zustand for state management

**Addresses:** Table stakes features — task management core, team communication, views & organization, basic permissions

**Avoids:** "No clear use cases defined" — implementing 3-5 core workflows with guided onboarding; "Treating agent as drop-in replacement" — designing new agent-first workflows rather than mimicking existing tools

### Phase 6: Workflow Builder & Integrations (Weeks 15-20)
**Rationale:** Visual workflow builder is a key differentiator but depends on all prior infrastructure. Linear integration provides concrete value by connecting to existing project management systems.

**Delivers:** React Flow-based visual workflow editor, drag-and-drop block palette (trigger, condition, agent, action, memory blocks), block configuration UI with parameter inputs, workflow execution engine with Temporal-style durability, workflow templates for common patterns, Linear integration with @linear/sdk (create/update issues, webhooks for updates), webhook management for external triggers, workflow version control and rollback

**Stack elements:** React Flow 12.x, ELKjs for auto-layout, @linear/sdk

**Implements:** Workflow Engine from ARCHITECTURE.md

**Addresses:** Differentiators — building blocks architecture, visual workflow builder; Tier 1 feature "Custom block creation" (basic version)

**Avoids:** "Linear API polling" — using webhooks and GraphQL subscriptions; "Query complexity limits" — calculating query complexity before execution; "Building a monolithic God Agent" — blocks represent specialized agent capabilities rather than one giant agent

**Research flag:** Needs `/gsd:research-phase` for Linear webhook setup, query complexity optimization, and workflow execution patterns

### Phase Ordering Rationale

The six-phase structure addresses research findings in several ways:

- **Infrastructure-first approach** prevents scaling pitfalls by establishing production-ready database, caching, and authentication before feature development (avoids "underestimating infrastructure requirements")
- **LLM + memory before agents** allows testing provider abstraction and cost controls with simple queries before complex agent logic (avoids "output token cost surprise")
- **Multi-agent architecture from start** prevents needing to refactor from monolithic design (avoids "building monolithic God Agent")
- **Telegram before WhatsApp** provides working messaging MVP while WhatsApp templates undergo approval (avoids "template approval delays")
- **Basic UI before workflow builder** validates agent interactions with simple interface before investing in complex visual editor (faster path to usable product)
- **Workflow builder last** because it depends on agent orchestration, messaging interfaces, and web UI foundation (respects dependency graph)

**MVP path (Phases 1-5, 8-10 weeks):** Delivers self-hosted BlockBot with Telegram integration, basic PM functionality, and conversational agent interaction. Skips visual workflow builder and WhatsApp integration. Sufficient for early adopters to validate core value proposition (conversational PM agent).

**Full differentiator release (Phases 1-6, 14-20 weeks):** Adds visual workflow builder and Linear integration, completing the unique value proposition (self-hosted + conversational + modular + AI-enhanced + visual builder).

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 2 (LLM Infrastructure):** Vector DB selection requires decision based on scale expectations, budget, and self-hosting complexity; RAG chunking strategy needs domain-specific optimization for PM conversations vs documentation vs code
- **Phase 3 (Agent Core):** Tool interface design needs architectural decision on how blocks expose capabilities to agents; multi-agent communication protocol needs specification
- **Phase 4 (Messaging Interfaces):** WhatsApp Business API setup has significant operational complexity (business verification timeline, template approval process, tier progression strategy); rate limiting implementation needs careful design given flexible Telegram limits and conversation-based WhatsApp limits
- **Phase 6 (Workflow Builder & Integrations):** Linear GraphQL query complexity optimization requires understanding their specific limits and designing efficient queries; workflow execution engine durability strategy (checkpointing, replay, error recovery) needs detailed design

**Phases with well-documented patterns (skip research-phase):**

- **Phase 1 (Core Infrastructure):** PostgreSQL multi-tenancy with schema-per-tenant is established pattern; JWT authentication and REST/GraphQL API are well-documented; Next.js setup is standard
- **Phase 5 (Web UI & Basic PM):** React + Next.js + Tailwind is heavily documented; basic CRUD UI patterns are standard; Kanban board implementations have extensive examples

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH (95%)** | Core technologies (Node.js, Next.js, PostgreSQL, BullMQ) are battle-tested with extensive production usage documented. LiteLLM and React Flow have strong track records in similar applications (Stripe, Typeform). Minimal risk in technology selection. |
| Features | **HIGH (90%)** | Table stakes features are well-defined across competitor analysis (40+ PM tools reviewed). Differentiators validated against market gaps (no competitor combines all five: self-hosted + conversational + modular + AI + visual). Anti-features supported by 2025/2026 trend analysis. |
| Architecture | **MEDIUM-HIGH (80%)** | Component patterns (multi-agent orchestration, RAG pipeline, workflow engine) are validated in production systems. Specific implementation details (tool interface, memory schemas, workflow durability) need refinement during development. Multi-tenancy strategy is standard but needs testing at scale. |
| Pitfalls | **HIGH (90%)** | Based on post-mortems, industry reports, and 2025 AI failure analysis. WhatsApp/Telegram gotchas documented from API provider sources. Open source sustainability insights from maintainer surveys and case studies. High confidence these are real risks requiring mitigation. |

**Overall confidence:** HIGH (88% average)

The research provides strong foundation for roadmap creation with clear technology choices, feature prioritization, and risk mitigation strategies. Medium confidence area (Architecture implementation details) is appropriate for this stage - detailed design happens during phase planning.

### Gaps to Address

While research confidence is high, several areas need validation during planning and implementation:

**1. Vector DB sizing and performance**
- **Gap:** Research covers general pgvector/Qdrant/Pinecone capabilities but lacks specific guidance for BlockBot's expected scale (users per project, conversation volume, document size)
- **Handle:** During Phase 2 planning, run benchmarks with representative data volumes; consider starting with pgvector (simplest) and migrating to dedicated vector DB if performance insufficient

**2. WhatsApp Business API costs and tier progression**
- **Gap:** Research identifies conversation-based pricing and tier limits (250 -> 2K -> 10K -> 100K) but lacks specifics on: (a) cost per conversation at each tier, (b) timeline for tier increases based on quality score, (c) realistic quality score maintenance strategies
- **Handle:** During Phase 4 planning, request detailed pricing from WhatsApp Business Solution Provider; analyze quality metrics dashboard; plan conservative tier progression (assume staying at 250 conversations for 2-3 months)

**3. Agent tool framework design**
- **Gap:** Research validates multi-agent architecture and tool-calling patterns but lacks specific design for how visual workflow blocks expose capabilities to agents (code generation? JSON schemas? function calling?)
- **Handle:** During Phase 3 planning, prototype tool interface with 2-3 example blocks; validate with LangChain.js function calling; document block development API

**4. Workflow execution durability and recovery**
- **Gap:** Research recommends Temporal-style durability but lacks specific implementation strategy for checkpointing, replay after failures, and handling partial workflow execution
- **Handle:** During Phase 6 planning, research BullMQ durability patterns; consider whether full Temporal adoption is needed or if BullMQ parent-child jobs + idempotent operations suffice; prototype checkpoint/resume for long-running agent workflows

**5. Self-hosting documentation and support burden**
- **Gap:** Research identifies DevOps overhead (10-20 hours/month) and infrastructure costs ($300-500/month) but lacks specifics on what users will struggle with (Docker networking? Environment variables? Backup/restore procedures?)
- **Handle:** During all phases, prioritize developer experience in self-hosting; create detailed deployment guides; consider providing Docker Compose templates with sensible defaults; plan for common troubleshooting scenarios

**6. Open source community building strategy**
- **Gap:** Research covers maintainer burnout and toxic interactions but lacks proactive strategy for building healthy community from start (contribution guidelines, issue templates, community spaces)
- **Handle:** Before Phase 1, establish Code of Conduct, CONTRIBUTING.md, issue templates, architectural decision records (ADRs); consider Discord/GitHub Discussions for community; document decision-making process

These gaps don't undermine the overall research quality but represent areas where planning should include additional investigation or prototyping before committing to specific implementations.

## Sources

### Technology Stack (HIGH confidence)
- [Top 8 LLM Frameworks for Building AI Agents in 2026](https://www.secondtalent.com/resources/top-llm-frameworks-for-building-ai-agents/) — AI agent framework comparison
- [LiteLLM Documentation](https://docs.litellm.ai/docs/) — LLM abstraction layer official docs
- [React Flow](https://reactflow.dev) and [Workflow Editor Template](https://reactflow.dev/ui/templates/workflow-editor) — visual editor library and templates
- [BullMQ Documentation](https://bullmq.io/) — job queue official docs
- [Node.js vs Python Backend 2025](https://mobilunity.com/blog/node-js-vs-python/) — runtime performance comparison
- [Next.js 15.5 Release Notes](https://nextjs.org/blog/next-15-5) — framework capabilities
- [PostgreSQL as Vector Database](https://airbyte.com/data-engineering-resources/postgresql-as-a-vector-database) — pgvector analysis
- [grammY Telegram Framework](https://grammy.dev/) — Telegram bot SDK official docs
- [WhatsApp Node.js SDK](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/) — WhatsApp official SDK
- [Linear API Documentation](https://linear.app/docs/api-and-webhooks) — Linear integration official docs

### Feature Research (HIGH confidence)
- [Epicflow: AI Agents for Project Management](https://www.epicflow.com/blog/ai-agents-for-project-management/) — market analysis and trends
- [Zapier: Best AI Project Management Tools 2026](https://zapier.com/blog/best-ai-project-management-tools/) — competitive feature analysis
- [Plane: Top 6 Open Source PM Software 2026](https://plane.so/blog/top-6-open-source-project-management-software-in-2026) — open source competitor review
- [Digital Project Manager: Essential PM Features](https://thedigitalprojectmanager.com/project-management/common-features-project-management-software/) — table stakes feature definition
- [Monday.com: Best AI Agents](https://monday.com/blog/ai-agents/best-ai-agents/) — AI-enhanced PM capabilities

### Architecture Patterns (MEDIUM-HIGH confidence)
- [Comparative Analysis of LLM Agent Frameworks](https://uplatz.com/blog/a-comparative-architectural-analysis-of-llm-agent-frameworks-langchain-llamaindex-and-autogpt-in-2025/) — agent architecture patterns
- [CrewAI Documentation](https://docs.crewai.com/en/introduction) and [GitHub](https://github.com/crewAIInc/crewAI) — multi-agent system reference implementation
- [n8n Deep Dive Architecture](https://jimmysong.io/blog/n8n-deep-dive/) — workflow engine architecture analysis
- [AI-Native Memory and Persistent Agents](https://ajithp.com/2025/06/30/ai-native-memory-persistent-agents-second-me/) — memory system design
- [Vector Databases for Agentic AI](https://www.getmonetizely.com/articles/how-do-vector-databases-power-agentic-ais-memory-and-knowledge-systems) — RAG pipeline patterns
- [Multi-Tenant AI Architecture (Microsoft Azure)](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/ai-machine-learning) — multi-tenancy patterns

### Pitfalls and Risks (HIGH confidence)
- [Composio - Why AI Agent Pilots Fail](https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap) — 2026 AI agent failure analysis
- [ISACA - Avoiding AI Pitfalls](https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/avoiding-ai-pitfalls-in-2026-lessons-learned-from-top-2025-incidents) — 2025 AI incident post-mortems
- [Directual - Why 95% of AI Projects Fail](https://www.directual.com/blog/ai-agents-in-2025-why-95-of-corporate-projects-fail) — organizational and technical failure patterns
- [DEV - Memory Is Not a Vector Database](https://dev.to/harshitk/memory-is-not-a-vector-database-why-ai-agents-need-beliefs-not-storage-2baj) — vector DB anti-patterns
- [WATI - WhatsApp API Rate Limits](https://www.wati.io/en/blog/whatsapp-business-api/whatsapp-api-rate-limits/) and [eesel.ai - WhatsApp Policy Changes](https://www.eesel.ai/blog/whatsapp-business-api-latest-pricing-and-policy-changes) — messaging API operational issues
- [grammY - Flood Limits](https://grammy.dev/advanced/flood) — Telegram rate limiting documentation
- [Getmaxim - Why AI Agents Fail in Production](https://www.getmaxim.ai/articles/top-6-reasons-why-ai-agents-fail-in-production-and-how-to-fix-them/) — hallucination and reliability issues
- [Medium - Open Source Burnout Crisis](https://medium.com/@sohail_saifii/the-open-source-maintainer-burnout-crisis-nobodys-fixing-5cf4b459a72b) — maintainer sustainability
- [Open Source Guides - Maintaining Balance](https://opensource.guide/maintaining-balance-for-open-source-maintainers/) — community building best practices

### Cost and Scaling (MEDIUM-HIGH confidence)
- [Cloudidr - LLM Pricing Comparison](https://www.cloudidr.com/blog/llm-pricing-comparison-2026) — 2026 LLM API pricing analysis
- [Latenode n8n System Requirements](https://latenode.com/blog/low-code-no-code-platforms/n8n-setup-workflows-self-hosting-templates/n8n-system-requirements-2025-complete-hardware-specs-real-world-resource-analysis) — self-hosting infrastructure requirements
- [DEV - Real Limits of n8n](https://dev.to/alifar/the-real-limits-of-n8n-free-automation-what-you-need-to-know-before-shipping-to-production-59o6) — production scaling lessons

---
*Research completed: 2026-02-05*
*Ready for roadmap: YES*

**Next steps:** Use this summary as foundation for roadmap creation. Phase structure (1-6) provides starting point. Research flags identify which phases need additional investigation during planning. Confidence assessment and gaps guide risk management during execution.

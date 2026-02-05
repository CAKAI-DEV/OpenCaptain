# BlockBot Architecture Research

> Research on self-hosted AI agent platform architecture patterns
> Last Updated: 2026-02-05

## Table of Contents

1. [Component Diagram](#component-diagram)
2. [Data Flow](#data-flow)
3. [Agent Memory & Knowledge System](#agent-memory--knowledge-system)
4. [Multi-Tenancy Architecture](#multi-tenancy-architecture)
5. [Build Order & Dependencies](#build-order--dependencies)
6. [Scaling Considerations](#scaling-considerations)
7. [Research Sources](#research-sources)

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BLOCKBOT PLATFORM                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        PRESENTATION LAYER                                │    │
│  │  ┌─────────────────────┐    ┌──────────────────────────────────────┐   │    │
│  │  │   Web UI (React)    │    │      Messaging Adapters              │   │    │
│  │  │  ┌───────────────┐  │    │  ┌────────────┐  ┌───────────────┐  │   │    │
│  │  │  │ Block Editor  │  │    │  │  WhatsApp  │  │   Telegram    │  │   │    │
│  │  │  │ (n8n-style)   │  │    │  │  Adapter   │  │   Adapter     │  │   │    │
│  │  │  ├───────────────┤  │    │  └─────┬──────┘  └───────┬───────┘  │   │    │
│  │  │  │  Dashboards   │  │    │        │                  │          │   │    │
│  │  │  ├───────────────┤  │    │        └────────┬─────────┘          │   │    │
│  │  │  │ Project Mgmt  │  │    │                 │                    │   │    │
│  │  │  └───────┬───────┘  │    │                 ▼                    │   │    │
│  │  └──────────┼──────────┘    │    ┌────────────────────────┐       │   │    │
│  │             │               │    │  Message Queue (Redis) │       │   │    │
│  │             │               │    │  - Webhook receipt      │       │   │    │
│  │             │               │    │  - Async processing     │       │   │    │
│  │             │               │    └───────────┬────────────┘       │   │    │
│  └─────────────┼───────────────┴────────────────┼────────────────────┘    │
│                │                                 │                         │
│  ┌─────────────┼─────────────────────────────────┼──────────────────────┐  │
│  │             ▼           API GATEWAY           ▼                      │  │
│  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    REST/GraphQL API                            │ │  │
│  │  │  - Authentication (JWT + API Keys)                             │ │  │
│  │  │  - Rate Limiting                                               │ │  │
│  │  │  - Request Routing                                             │ │  │
│  │  │  - Webhook Validation (HMAC-SHA256)                            │ │  │
│  │  └────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
│                                     │                                      │
│  ┌──────────────────────────────────┼───────────────────────────────────┐  │
│  │                    ORCHESTRATION LAYER                               │  │
│  │                                  ▼                                   │  │
│  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │              Workflow Engine (Temporal-style)                  │ │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │  │
│  │  │  │  Workflows   │  │  Activities  │  │   Task Queue         │ │ │  │
│  │  │  │  (Durable)   │  │  (Retryable) │  │   (Priority-based)   │ │ │  │
│  │  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │ │  │
│  │  └────────────────────────────────────────────────────────────────┘ │  │
│  │                                  │                                   │  │
│  │                                  ▼                                   │  │
│  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │           Agent Orchestrator (CrewAI-inspired)                 │ │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐│ │  │
│  │  │  │  PM Agent   │  │  Sub-agents │  │   Coding Agent Spawner  ││ │  │
│  │  │  │  (Primary)  │  │  (Workers)  │  │   - Claude Code         ││ │  │
│  │  │  │             │  │             │  │   - Codex               ││ │  │
│  │  │  │  - Planning │  │  - Research │  │   (Subprocess-based)    ││ │  │
│  │  │  │  - Routing  │  │  - Analysis │  └─────────────────────────┘│ │  │
│  │  │  │  - Decisions│  │  - Execution│                             │ │  │
│  │  │  └─────────────┘  └─────────────┘                             │ │  │
│  │  └────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
│                                     │                                      │
│  ┌──────────────────────────────────┼───────────────────────────────────┐  │
│  │                      INTELLIGENCE LAYER                              │  │
│  │                                  ▼                                   │  │
│  │  ┌───────────────────────────────────────────────────────────────┐  │  │
│  │  │              LLM Abstraction Layer (LiteLLM-style)            │  │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │  │
│  │  │  │   OpenAI    │  │  Anthropic  │  │   Local/Ollama      │   │  │  │
│  │  │  │   Provider  │  │  Provider   │  │   Provider          │   │  │  │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │  │  │
│  │  │                                                               │  │  │
│  │  │  - Unified API across providers                               │  │  │
│  │  │  - Cost tracking per tenant                                   │  │  │
│  │  │  - Fallback/retry logic                                       │  │  │
│  │  │  - Token usage monitoring                                     │  │  │
│  │  └───────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
│                                     │                                      │
│  ┌──────────────────────────────────┼───────────────────────────────────┐  │
│  │                    KNOWLEDGE & MEMORY LAYER                          │  │
│  │                                  ▼                                   │  │
│  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    Memory Manager                              │ │  │
│  │  │  ┌──────────────────┐  ┌──────────────────┐                   │ │  │
│  │  │  │ Short-term Memory│  │ Long-term Memory │                   │ │  │
│  │  │  │ (Conversation)   │  │ (Project KB)     │                   │ │  │
│  │  │  │ - Redis/Cache    │  │ - Vector Store   │                   │ │  │
│  │  │  │ - Session state  │  │ - Document Store │                   │ │  │
│  │  │  └──────────────────┘  └──────────────────┘                   │ │  │
│  │  └────────────────────────────────────────────────────────────────┘ │  │
│  │                                  │                                   │  │
│  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    RAG Pipeline                                │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │ │  │
│  │  │  │  Ingestion │─▶│ Chunking   │─▶│ Embedding  │─▶│  Index   │ │ │  │
│  │  │  │  (Docs)    │  │ (Semantic) │  │ (OpenAI/   │  │ (Qdrant/ │ │ │  │
│  │  │  │            │  │            │  │  Local)    │  │ Pinecone)│ │ │  │
│  │  │  └────────────┘  └────────────┘  └────────────┘  └──────────┘ │ │  │
│  │  │                                                                │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌───────────────────────────┐│ │  │
│  │  │  │  Query     │─▶│ Retrieval  │─▶│  Context Augmentation     ││ │  │
│  │  │  │            │  │ (Hybrid)   │  │  (Reranking + Injection)  ││ │  │
│  │  │  └────────────┘  └────────────┘  └───────────────────────────┘│ │  │
│  │  └────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    INTEGRATION LAYER                                 │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────────┐│  │
│  │  │    Linear     │  │   GitHub      │  │   External Tools          ││  │
│  │  │  Integration  │  │   Integration │  │   (Extensible)            ││  │
│  │  │               │  │               │  │                           ││  │
│  │  │  - GraphQL    │  │  - REST/GH CLI│  │  - Webhook handlers       ││  │
│  │  │  - Webhooks   │  │  - Webhooks   │  │  - OAuth2 connections     ││  │
│  │  │  - Sync       │  │  - PR/Issues  │  │  - Plugin architecture    ││  │
│  │  └───────────────┘  └───────────────┘  └───────────────────────────┘│  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    DATA LAYER                                        │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────────┐│  │
│  │  │  PostgreSQL   │  │  Redis        │  │  Object Storage (S3)     ││  │
│  │  │               │  │               │  │                           ││  │
│  │  │  - Users      │  │  - Sessions   │  │  - Documents              ││  │
│  │  │  - Projects   │  │  - Cache      │  │  - Attachments            ││  │
│  │  │  - Workflows  │  │  - Pub/Sub    │  │  - Exports                ││  │
│  │  │  - Audit logs │  │  - Job Queue  │  │                           ││  │
│  │  └───────────────┘  └───────────────┘  └───────────────────────────┘│  │
│  │                                                                      │  │
│  │  ┌───────────────────────────────────────────────────────────────┐  │  │
│  │  │              Vector Database (Qdrant/Pinecone)                │  │  │
│  │  │  - Per-tenant collections (strict isolation)                  │  │  │
│  │  │  - Hybrid search (dense + sparse vectors)                     │  │  │
│  │  │  - Metadata filtering                                         │  │  │
│  │  └───────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. User Interaction Flow (Web UI)

```
User ──▶ Web UI ──▶ API Gateway ──▶ Auth Middleware
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │   Route Handler       │
                              │   - Validate request  │
                              │   - Check permissions │
                              └───────────┬───────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
            ┌───────────────┐   ┌────────────────┐   ┌────────────────┐
            │ Workflow CRUD │   │ Agent Invoke   │   │ Dashboard/Read │
            │ (Block Editor)│   │ (Chat/Execute) │   │ (Analytics)    │
            └───────┬───────┘   └────────┬───────┘   └────────┬───────┘
                    │                    │                    │
                    ▼                    ▼                    ▼
            ┌───────────────┐   ┌────────────────┐   ┌────────────────┐
            │  PostgreSQL   │   │ Agent Orchestr.│   │ Query Service  │
            │  (Workflows)  │   │ + LLM Layer    │   │ (Aggregations) │
            └───────────────┘   └────────────────┘   └────────────────┘
```

### 2. Messaging Flow (WhatsApp/Telegram)

```
WhatsApp/Telegram ──▶ Webhook Endpoint
                             │
                             ▼
                    ┌────────────────────┐
                    │ Validate Signature │ (HMAC-SHA256)
                    │ Respond 200 OK     │ (immediately)
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │   Message Queue    │ (Redis/Bull)
                    │   - Enqueue event  │
                    │   - Priority tag   │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │   Queue Worker     │ (Async)
                    │   - Dequeue        │
                    │   - Process        │
                    └────────┬───────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ Identify User │ │ Load Context  │ │ Rate Limit    │
    │ + Project     │ │ (Memory)      │ │ Check         │
    └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
            └─────────────────┼─────────────────┘
                              ▼
                    ┌────────────────────┐
                    │ Agent Orchestrator │
                    │ - Intent detection │
                    │ - Tool selection   │
                    │ - Response gen     │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Send Response      │
                    │ (WhatsApp/Telegram │
                    │  API)              │
                    └────────────────────┘
```

### 3. Agent Execution Flow

```
Trigger (User/Webhook/Schedule)
            │
            ▼
┌───────────────────────────────────────┐
│        Agent Orchestrator             │
│  ┌─────────────────────────────────┐  │
│  │  1. Load agent configuration    │  │
│  │  2. Retrieve relevant memory    │  │
│  │  3. Build context (RAG query)   │  │
│  └─────────────────────────────────┘  │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│        ReAct Loop (LangGraph-style)   │
│  ┌─────────────────────────────────┐  │
│  │  THINK: Analyze task + context  │◀─┼──────┐
│  └─────────────────────────────────┘  │      │
│                   │                   │      │
│                   ▼                   │      │
│  ┌─────────────────────────────────┐  │      │
│  │  ACT: Select & execute tool     │  │      │
│  │  - Internal tools               │  │      │
│  │  - External integrations        │  │      │
│  │  - Spawn coding agent           │  │      │
│  └─────────────────────────────────┘  │      │
│                   │                   │      │
│                   ▼                   │      │
│  ┌─────────────────────────────────┐  │      │
│  │  OBSERVE: Process tool result   │──┼──────┘
│  │  - Success? Continue/Complete   │  │   (iterate)
│  │  - Failure? Retry/Escalate      │  │
│  └─────────────────────────────────┘  │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│        Post-Execution                 │
│  - Update memory (conversation)       │
│  - Store artifacts                    │
│  - Update project state (Linear)      │
│  - Emit events for webhooks           │
└───────────────────────────────────────┘
```

### 4. Coding Agent Spawn Flow

```
PM Agent determines coding task needed
            │
            ▼
┌───────────────────────────────────────┐
│    Coding Agent Spawner               │
│  ┌─────────────────────────────────┐  │
│  │  1. Select agent type           │  │
│  │     - Claude Code (preferred)   │  │
│  │     - Codex (fallback)          │  │
│  │                                 │  │
│  │  2. Prepare context             │  │
│  │     - Task description          │  │
│  │     - Relevant code context     │  │
│  │     - Project constraints       │  │
│  │                                 │  │
│  │  3. Spawn subprocess            │  │
│  │     - Isolated execution        │  │
│  │     - Resource limits           │  │
│  │     - Timeout handling          │  │
│  └─────────────────────────────────┘  │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│    Subprocess Execution               │
│    (Sandboxed environment)            │
│  ┌─────────────────────────────────┐  │
│  │  - Git clone/checkout           │  │
│  │  - Agent executes task          │  │
│  │  - Creates commits/PRs          │  │
│  │  - Streams progress updates     │  │
│  └─────────────────────────────────┘  │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│    Result Collection                  │
│  - Capture stdout/stderr              │
│  - Parse structured output            │
│  - Store artifacts                    │
│  - Update parent task status          │
│  - Report back to PM Agent            │
└───────────────────────────────────────┘
```

---

## Agent Memory & Knowledge System

### Memory Architecture (Inspired by AI-Native Memory Patterns)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MEMORY SYSTEM                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 WORKING MEMORY (Ephemeral)                   │   │
│  │                                                              │   │
│  │  Purpose: Current conversation/task context                  │   │
│  │  Storage: Redis (TTL-based expiration)                       │   │
│  │  Scope: Per-session, per-user                                │   │
│  │                                                              │   │
│  │  Contents:                                                   │   │
│  │  - Current conversation history (sliding window)             │   │
│  │  - Active task state                                         │   │
│  │  - Tool call results (recent)                                │   │
│  │  - User preferences (session-scoped)                         │   │
│  │                                                              │   │
│  │  Implementation:                                             │   │
│  │  ```                                                         │   │
│  │  working_memory:{tenant_id}:{session_id}:{user_id}           │   │
│  │  ```                                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 EPISODIC MEMORY (Durable)                    │   │
│  │                                                              │   │
│  │  Purpose: Past interactions & decisions                      │   │
│  │  Storage: PostgreSQL + Vector DB                             │   │
│  │  Scope: Per-project, searchable                              │   │
│  │                                                              │   │
│  │  Contents:                                                   │   │
│  │  - Conversation summaries                                    │   │
│  │  - Key decisions made                                        │   │
│  │  - Task outcomes (success/failure patterns)                  │   │
│  │  - User feedback signals                                     │   │
│  │                                                              │   │
│  │  Retrieval:                                                  │   │
│  │  - Semantic search (similar past situations)                 │   │
│  │  - Temporal queries (recent history)                         │   │
│  │  - Entity-based (specific user, task, feature)               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 SEMANTIC MEMORY (Knowledge Base)             │   │
│  │                                                              │   │
│  │  Purpose: Project knowledge & documentation                  │   │
│  │  Storage: Vector DB (Qdrant/Pinecone)                        │   │
│  │  Scope: Per-project, versioned                               │   │
│  │                                                              │   │
│  │  Contents:                                                   │   │
│  │  - Project documentation                                     │   │
│  │  - Technical specs & ADRs                                    │   │
│  │  - Codebase structure (indexed)                              │   │
│  │  - Team conventions & guidelines                             │   │
│  │  - External references (linked docs)                         │   │
│  │                                                              │   │
│  │  Ingestion Pipeline:                                         │   │
│  │  1. Document → Chunking (semantic boundaries)                │   │
│  │  2. Chunks → Embeddings (text-embedding-3-small)             │   │
│  │  3. Embeddings → Vector Index (with metadata)                │   │
│  │  4. Metadata → Relational index (filtering)                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 PROCEDURAL MEMORY (Skills)                   │   │
│  │                                                              │   │
│  │  Purpose: Learned workflows & procedures                     │   │
│  │  Storage: PostgreSQL (workflow definitions)                  │   │
│  │  Scope: Per-project or global templates                      │   │
│  │                                                              │   │
│  │  Contents:                                                   │   │
│  │  - Workflow templates (block definitions)                    │   │
│  │  - Tool usage patterns                                       │   │
│  │  - Response templates                                        │   │
│  │  - Escalation procedures                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### RAG Pipeline Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RAG PIPELINE                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  INGESTION PHASE                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Sources              Processing              Storage        │   │
│  │  ┌──────────┐        ┌──────────┐           ┌──────────┐   │   │
│  │  │ Docs     │───────▶│ Parse    │           │ Vector   │   │   │
│  │  │ (MD,PDF) │        │ Extract  │           │ DB       │   │   │
│  │  └──────────┘        └────┬─────┘           └────▲─────┘   │   │
│  │                           │                      │          │   │
│  │  ┌──────────┐        ┌────▼─────┐           ┌────┴─────┐   │   │
│  │  │ Code     │───────▶│ Chunk    │──────────▶│ Embed    │   │   │
│  │  │ (Repo)   │        │ (Smart)  │           │ (Batch)  │   │   │
│  │  └──────────┘        └────┬─────┘           └──────────┘   │   │
│  │                           │                                 │   │
│  │  ┌──────────┐        ┌────▼─────┐           ┌──────────┐   │   │
│  │  │ Convos   │───────▶│ Summarize│──────────▶│ Postgres │   │   │
│  │  │ (History)│        │ (LLM)    │           │ (Meta)   │   │   │
│  │  └──────────┘        └──────────┘           └──────────┘   │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  RETRIEVAL PHASE (Hybrid Search)                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Query ──▶ ┌────────────────────────────────────┐           │   │
│  │            │  Query Understanding                │           │   │
│  │            │  - Intent classification            │           │   │
│  │            │  - Entity extraction                │           │   │
│  │            │  - Query expansion                  │           │   │
│  │            └────────────────┬───────────────────┘           │   │
│  │                             │                                │   │
│  │            ┌────────────────┼────────────────┐               │   │
│  │            ▼                ▼                ▼               │   │
│  │    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐   │   │
│  │    │ Dense Vector  │ │ Sparse/BM25   │ │ Metadata      │   │   │
│  │    │ Search        │ │ Search        │ │ Filters       │   │   │
│  │    └───────┬───────┘ └───────┬───────┘ └───────┬───────┘   │   │
│  │            │                 │                 │            │   │
│  │            └─────────────────┼─────────────────┘            │   │
│  │                              ▼                               │   │
│  │            ┌────────────────────────────────────┐           │   │
│  │            │  Reciprocal Rank Fusion (RRF)      │           │   │
│  │            │  - Combine scores                   │           │   │
│  │            │  - Rerank with cross-encoder        │           │   │
│  │            │  - Deduplicate                      │           │   │
│  │            └────────────────┬───────────────────┘           │   │
│  │                             │                                │   │
│  │                             ▼                                │   │
│  │            ┌────────────────────────────────────┐           │   │
│  │            │  Context Assembly                   │           │   │
│  │            │  - Order by relevance               │           │   │
│  │            │  - Fit to context window            │           │   │
│  │            │  - Add source citations             │           │   │
│  │            └────────────────────────────────────┘           │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenancy Architecture

### Tenant Isolation Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                MULTI-TENANCY MODEL                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  HIERARCHY                                                          │
│                                                                     │
│  Organization (Tenant)                                              │
│  └── Project 1                                                      │
│      ├── Members (Users with Roles)                                 │
│      │   ├── Owner (full access)                                    │
│      │   ├── Admin (manage settings)                                │
│      │   ├── Member (standard access)                               │
│      │   └── Viewer (read-only)                                     │
│      ├── Agent Configuration                                        │
│      ├── Knowledge Base (isolated)                                  │
│      ├── Workflows (isolated)                                       │
│      └── Integrations (Linear, GitHub, etc.)                        │
│  └── Project 2                                                      │
│      └── ...                                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Database Isolation Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                DATABASE ISOLATION                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  APPROACH: Shared Database, Schema-per-Tenant (Bridge Model)        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL                                                  │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │  public schema (shared)                              │    │   │
│  │  │  - organizations                                     │    │   │
│  │  │  - users                                             │    │   │
│  │  │  - global_settings                                   │    │   │
│  │  │  - audit_logs                                        │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │  tenant_{org_id} schema                              │    │   │
│  │  │  - projects                                          │    │   │
│  │  │  - workflows                                         │    │   │
│  │  │  - conversations                                     │    │   │
│  │  │  - agent_configs                                     │    │   │
│  │  │  - integrations                                      │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Vector Database (Qdrant)                                    │   │
│  │                                                              │   │
│  │  Collection naming: {org_id}_{project_id}_knowledge          │   │
│  │                                                              │   │
│  │  ┌───────────────────┐  ┌───────────────────┐               │   │
│  │  │ org1_proj1_kb     │  │ org1_proj2_kb     │               │   │
│  │  └───────────────────┘  └───────────────────┘               │   │
│  │  ┌───────────────────┐                                      │   │
│  │  │ org2_proj1_kb     │  (Complete isolation)                │   │
│  │  └───────────────────┘                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Redis                                                       │   │
│  │                                                              │   │
│  │  Key prefixing: {org_id}:{project_id}:{resource}:{id}        │   │
│  │                                                              │   │
│  │  Examples:                                                   │   │
│  │  - org1:proj1:session:abc123                                 │   │
│  │  - org1:proj1:cache:query:def456                             │   │
│  │  - org1:proj1:queue:messages                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Role-Based Access Control (RBAC)

```
┌─────────────────────────────────────────────────────────────────────┐
│                RBAC MODEL                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PERMISSION MATRIX                                                  │
│                                                                     │
│  Resource/Action    │ Owner │ Admin │ Member │ Viewer │            │
│  ────────────────────┼───────┼───────┼────────┼────────┤            │
│  Project Settings   │  RW   │  RW   │   R    │   R    │            │
│  Agent Config       │  RW   │  RW   │   R    │   -    │            │
│  Workflows (Edit)   │  RW   │  RW   │   RW   │   R    │            │
│  Workflows (Execute)│  X    │  X    │   X    │   X    │            │
│  Knowledge Base     │  RW   │  RW   │   RW   │   R    │            │
│  Conversations      │  RW   │  RW   │   RW   │   R    │            │
│  Integrations       │  RW   │  RW   │   R    │   -    │            │
│  Members            │  RW   │  RW   │   R    │   R    │            │
│  Billing            │  RW   │  R    │   -    │   -    │            │
│  Delete Project     │  X    │  -    │   -    │   -    │            │
│                                                                     │
│  Legend: R=Read, W=Write, X=Execute, -=No Access                   │
│                                                                     │
│  IMPLEMENTATION                                                     │
│  ```typescript                                                      │
│  interface Permission {                                             │
│    resource: string;     // e.g., "workflows", "knowledge"          │
│    action: "read" | "write" | "execute" | "delete";                 │
│    scope: "own" | "project" | "organization";                       │
│  }                                                                  │
│                                                                     │
│  interface Role {                                                   │
│    name: string;                                                    │
│    permissions: Permission[];                                       │
│    inherits?: string;    // Role inheritance                        │
│  }                                                                  │
│  ```                                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Build Order & Dependencies

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│                BUILD DEPENDENCY GRAPH                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                        ┌───────────────────┐                        │
│                        │  Phase 1: Core    │                        │
│                        │  Infrastructure   │                        │
│                        └─────────┬─────────┘                        │
│                                  │                                  │
│         ┌────────────────────────┼────────────────────────┐         │
│         ▼                        ▼                        ▼         │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐   │
│  │ PostgreSQL  │         │   Redis     │         │  Object     │   │
│  │ Schema      │         │   Setup     │         │  Storage    │   │
│  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘   │
│         │                       │                       │          │
│         └───────────────────────┼───────────────────────┘          │
│                                 │                                   │
│                        ┌────────▼────────┐                         │
│                        │  Phase 2: Auth  │                         │
│                        │  & API          │                         │
│                        └────────┬────────┘                         │
│                                 │                                   │
│         ┌───────────────────────┼───────────────────────┐          │
│         ▼                       ▼                       ▼          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐   │
│  │ Auth System │         │ API Gateway │         │ User/Tenant │   │
│  │ (JWT/OAuth) │         │ (REST/GQL)  │         │ Management  │   │
│  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘   │
│         │                       │                       │          │
│         └───────────────────────┼───────────────────────┘          │
│                                 │                                   │
│                        ┌────────▼────────┐                         │
│                        │  Phase 3: LLM   │                         │
│                        │  Infrastructure │                         │
│                        └────────┬────────┘                         │
│                                 │                                   │
│         ┌───────────────────────┼───────────────────────┐          │
│         ▼                       ▼                       ▼          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐   │
│  │ LLM Abstrac-│         │ Vector DB   │         │ RAG         │   │
│  │ tion Layer  │         │ Setup       │         │ Pipeline    │   │
│  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘   │
│         │                       │                       │          │
│         └───────────────────────┼───────────────────────┘          │
│                                 │                                   │
│                        ┌────────▼────────┐                         │
│                        │  Phase 4: Agent │                         │
│                        │  Core           │                         │
│                        └────────┬────────┘                         │
│                                 │                                   │
│         ┌───────────────────────┼───────────────────────┐          │
│         ▼                       ▼                       ▼          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐   │
│  │ Memory      │         │ Agent       │         │ Tool        │   │
│  │ Manager     │         │ Orchestrator│         │ Framework   │   │
│  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘   │
│         │                       │                       │          │
│         └───────────────────────┼───────────────────────┘          │
│                                 │                                   │
│                        ┌────────▼────────┐                         │
│                        │  Phase 5:       │                         │
│                        │  Interfaces     │                         │
│                        └────────┬────────┘                         │
│                                 │                                   │
│    ┌────────────────────────────┼────────────────────────────┐     │
│    ▼                            ▼                            ▼     │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐   │
│  │ Web UI      │         │ WhatsApp    │         │ Telegram    │   │
│  │ (React)     │         │ Adapter     │         │ Adapter     │   │
│  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘   │
│         │                       │                       │          │
│         └───────────────────────┼───────────────────────┘          │
│                                 │                                   │
│                        ┌────────▼────────┐                         │
│                        │  Phase 6:       │                         │
│                        │  Advanced       │                         │
│                        └────────┬────────┘                         │
│                                 │                                   │
│    ┌────────────────────────────┼────────────────────────────┐     │
│    ▼                            ▼                            ▼     │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐   │
│  │ Workflow    │         │ Linear      │         │ Coding Agent│   │
│  │ Engine      │         │ Integration │         │ Spawner     │   │
│  └─────────────┘         └─────────────┘         └─────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Detailed Build Phases

| Phase | Component | Estimated Time | Dependencies | Deliverable |
|-------|-----------|---------------|--------------|-------------|
| **1** | **Core Infrastructure** | 1-2 weeks | None | |
| 1.1 | PostgreSQL Schema | 3 days | - | Database migrations, models |
| 1.2 | Redis Setup | 1 day | - | Cache layer, pub/sub |
| 1.3 | Object Storage | 1 day | - | S3-compatible storage |
| **2** | **Auth & API** | 2-3 weeks | Phase 1 | |
| 2.1 | Auth System | 5 days | 1.1 | JWT, OAuth2, API keys |
| 2.2 | API Gateway | 5 days | 1.1, 1.2 | REST/GraphQL endpoints |
| 2.3 | Tenant Management | 4 days | 2.1, 2.2 | Multi-tenancy, RBAC |
| **3** | **LLM Infrastructure** | 2 weeks | Phase 2 | |
| 3.1 | LLM Abstraction | 3 days | - | Provider-agnostic interface |
| 3.2 | Vector DB Setup | 2 days | - | Qdrant/Pinecone deployment |
| 3.3 | RAG Pipeline | 5 days | 3.1, 3.2 | Ingestion + retrieval |
| **4** | **Agent Core** | 3-4 weeks | Phase 3 | |
| 4.1 | Memory Manager | 5 days | 1.2, 3.2 | Working/episodic/semantic memory |
| 4.2 | Agent Orchestrator | 10 days | 3.1, 4.1 | ReAct loop, routing |
| 4.3 | Tool Framework | 5 days | 4.2 | Extensible tool system |
| **5** | **Interfaces** | 3-4 weeks | Phase 4 | |
| 5.1 | Web UI (React) | 10 days | 2.2 | Dashboard, basic chat |
| 5.2 | Block Editor | 7 days | 5.1 | n8n-style visual editor |
| 5.3 | WhatsApp Adapter | 5 days | 4.2 | Webhook + message handling |
| 5.4 | Telegram Adapter | 3 days | 5.3 | Reuse patterns from WhatsApp |
| **6** | **Advanced Features** | 4-6 weeks | Phase 5 | |
| 6.1 | Workflow Engine | 10 days | 5.2, 4.2 | Temporal-style execution |
| 6.2 | Linear Integration | 5 days | 4.3 | Bi-directional sync |
| 6.3 | Coding Agent Spawner | 7 days | 4.2, 6.1 | Claude Code/Codex subprocess |

### Minimum Viable Product (MVP) Path

```
MVP Scope (8-10 weeks):
├── Phase 1: Core Infrastructure (complete)
├── Phase 2: Auth & API (complete)
├── Phase 3: LLM Infrastructure (complete)
├── Phase 4: Agent Core (4.1, 4.2 only)
├── Phase 5: Interfaces (5.1, 5.3 only)
└── Phase 6: Skip for MVP

MVP Features:
✓ Single-tenant deployment
✓ Basic web chat interface
✓ WhatsApp integration
✓ LLM-powered responses
✓ Basic RAG for project knowledge
✓ Simple conversation memory

Post-MVP:
+ Multi-tenancy & RBAC
+ Block editor & workflows
+ Linear integration
+ Coding agent spawning
+ Telegram support
```

---

## Scaling Considerations

### Horizontal Scaling Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                SCALED DEPLOYMENT                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 Load Balancer (nginx/Traefik)                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                │                                    │
│         ┌─────────────────────┬┴┬─────────────────────┐            │
│         ▼                     ▼ ▼                     ▼            │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐       │
│  │ API Server  │       │ API Server  │       │ API Server  │       │
│  │ Instance 1  │       │ Instance 2  │       │ Instance N  │       │
│  └─────────────┘       └─────────────┘       └─────────────┘       │
│         │                     │                     │              │
│         └─────────────────────┼─────────────────────┘              │
│                               │                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Message Queue (Redis Cluster)           │   │
│  │                     - Webhook events                        │   │
│  │                     - Agent tasks                           │   │
│  │                     - Background jobs                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                               │                                    │
│         ┌─────────────────────┼─────────────────────┐              │
│         ▼                     ▼                     ▼              │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐       │
│  │ Worker      │       │ Worker      │       │ Worker      │       │
│  │ Instance 1  │       │ Instance 2  │       │ Instance N  │       │
│  │             │       │             │       │             │       │
│  │ - Agent     │       │ - Agent     │       │ - Agent     │       │
│  │   Execution │       │   Execution │       │   Execution │       │
│  │ - LLM calls │       │ - LLM calls │       │ - LLM calls │       │
│  └─────────────┘       └─────────────┘       └─────────────┘       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Data Layer (Scaled)                     │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │   │
│  │  │ PostgreSQL  │  │ Vector DB   │  │ Redis Cluster       │ │   │
│  │  │ (Primary +  │  │ (Qdrant     │  │ (Sentinel mode)     │ │   │
│  │  │  Replicas)  │  │  Cluster)   │  │                     │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Scaling Strategies by Component

| Component | Scaling Strategy | Considerations |
|-----------|-----------------|----------------|
| **API Servers** | Horizontal (stateless) | Session affinity not required; use Redis for shared state |
| **Agent Workers** | Horizontal (queue-based) | Scale based on queue depth; consider GPU workers for local LLMs |
| **PostgreSQL** | Read replicas + connection pooling | Use PgBouncer; consider Citus for sharding at scale |
| **Redis** | Cluster mode or Sentinel | Separate instances for cache vs. queue |
| **Vector DB** | Sharded collections | Qdrant supports distributed mode; shard by tenant |
| **Object Storage** | Managed service (S3) | Already horizontally scaled |
| **LLM Calls** | Rate limiting + fallbacks | Provider-level rate limits; implement circuit breakers |

### Performance Optimization Patterns

```
┌─────────────────────────────────────────────────────────────────────┐
│                OPTIMIZATION PATTERNS                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. CACHING LAYERS                                                  │
│     ┌─────────────────────────────────────────────────────────┐    │
│     │  L1: In-memory (per-instance)                            │    │
│     │      - Hot config data                                   │    │
│     │      - Compiled workflow definitions                     │    │
│     │                                                          │    │
│     │  L2: Redis (shared)                                      │    │
│     │      - Session data                                      │    │
│     │      - RAG query results (TTL: 15 min)                   │    │
│     │      - LLM response cache (semantic dedup)               │    │
│     │                                                          │    │
│     │  L3: Database query cache                                │    │
│     │      - Prepared statements                               │    │
│     │      - Materialized views for dashboards                 │    │
│     └─────────────────────────────────────────────────────────┘    │
│                                                                     │
│  2. ASYNC PROCESSING                                                │
│     ┌─────────────────────────────────────────────────────────┐    │
│     │  - Webhook handlers: Immediate ACK, async processing     │    │
│     │  - Document ingestion: Background jobs                   │    │
│     │  - Long-running agents: Workflow with checkpoints        │    │
│     │  - Notifications: Fire-and-forget queues                 │    │
│     └─────────────────────────────────────────────────────────┘    │
│                                                                     │
│  3. CONNECTION POOLING                                              │
│     ┌─────────────────────────────────────────────────────────┐    │
│     │  PostgreSQL: PgBouncer (transaction mode)                │    │
│     │  Redis: Built-in connection pooling                      │    │
│     │  HTTP (LLM APIs): Keep-alive + connection reuse          │    │
│     └─────────────────────────────────────────────────────────┘    │
│                                                                     │
│  4. RATE LIMITING & BACKPRESSURE                                    │
│     ┌─────────────────────────────────────────────────────────┐    │
│     │  - Per-tenant rate limits (token bucket)                 │    │
│     │  - LLM provider rate limit handling (exponential backoff)│    │
│     │  - Queue depth limits with rejection                     │    │
│     │  - Circuit breakers for external services                │    │
│     └─────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Cost Optimization

```
┌─────────────────────────────────────────────────────────────────────┐
│                COST OPTIMIZATION                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LLM COSTS (typically largest expense)                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  1. Model tiering:                                           │   │
│  │     - Simple queries → GPT-4o-mini / Claude Haiku            │   │
│  │     - Complex reasoning → GPT-4o / Claude Sonnet             │   │
│  │     - Specialized tasks → Fine-tuned models                  │   │
│  │                                                              │   │
│  │  2. Token optimization:                                      │   │
│  │     - Aggressive context pruning                             │   │
│  │     - Response length limits                                 │   │
│  │     - Semantic caching (avoid duplicate queries)             │   │
│  │                                                              │   │
│  │  3. Local models for low-stakes tasks:                       │   │
│  │     - Intent classification → Local classifier               │   │
│  │     - Embedding generation → Local embedding model           │   │
│  │     - Simple Q&A → Ollama (Llama 3)                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  INFRASTRUCTURE COSTS                                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  1. Right-sizing:                                            │   │
│  │     - Start small, scale based on metrics                    │   │
│  │     - Use spot instances for workers                         │   │
│  │                                                              │   │
│  │  2. Managed vs. self-hosted:                                 │   │
│  │     - Small scale: Managed services (simpler)                │   │
│  │     - Large scale: Self-hosted (cheaper per unit)            │   │
│  │                                                              │   │
│  │  3. Storage optimization:                                    │   │
│  │     - Tiered storage (hot/cold)                              │   │
│  │     - Vector DB pruning (old embeddings)                     │   │
│  │     - Log retention policies                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Research Sources

### AI Agent Frameworks
- [Comparative Analysis of LLM Agent Frameworks (Uplatz)](https://uplatz.com/blog/a-comparative-architectural-analysis-of-llm-agent-frameworks-langchain-llamaindex-and-autogpt-in-2025/)
- [Complete Guide to AI Agent Frameworks (Langflow)](https://www.langflow.org/blog/the-complete-guide-to-choosing-an-ai-agent-framework-in-2025)
- [Top AI Agent Frameworks 2025 (Ideas2IT)](https://www.ideas2it.com/blogs/ai-agent-frameworks)
- [AI Agent Frameworks Guide (IBM)](https://www.ibm.com/think/insights/top-ai-agent-frameworks)

### CrewAI & Multi-Agent Systems
- [CrewAI GitHub Repository](https://github.com/crewAIInc/crewAI)
- [CrewAI Documentation](https://docs.crewai.com/en/introduction)
- [CrewAI Multi-Agent Tutorial (Firecrawl)](https://www.firecrawl.dev/blog/crewai-multi-agent-systems-tutorial)
- [Hierarchical AI Agents Guide (ActiveWizards)](https://activewizards.com/blog/hierarchical-ai-agents-a-guide-to-crewai-delegation)

### Workflow Orchestration
- [n8n Deep Dive Architecture (Jimmy Song)](https://jimmysong.io/blog/n8n-deep-dive/)
- [n8n Workflow Components](https://docs.n8n.io/workflows/components/)
- [Temporal Workflow Orchestration (Medium)](https://medium.com/@surajsub_68985/temporal-revolutionizing-workflow-orchestration-in-microservices-architectures-f8265afa4dc0)
- [Temporal Platform Overview](https://temporal.io/how-it-works)

### Memory & RAG Systems
- [AI-Native Memory and Persistent Agents](https://ajithp.com/2025/06/30/ai-native-memory-persistent-agents-second-me/)
- [Vector Databases for Agentic AI](https://www.getmonetizely.com/articles/how-do-vector-databases-power-agentic-ais-memory-and-knowledge-systems)
- [RAG vs AI Agents Guide (Medium)](https://medium.com/@tuguidragos/rag-vs-ai-agents-the-definitive-2025-guide-to-ai-automation-architecture-3d5157dd0097)
- [Beyond RAG: Context Engineering (Towards Data Science)](https://towardsdatascience.com/beyond-rag/)

### Multi-Tenancy
- [Multi-Tenant AI Architecture (Microsoft Azure)](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/ai-machine-learning)
- [Multi-Tenant AI on AWS](https://aws.amazon.com/blogs/machine-learning/build-a-multi-tenant-generative-ai-environment-for-your-enterprise-on-aws/)
- [Multi-Tenant SaaS Architecture (QuantumByte)](https://quantumbyte.ai/articles/multi-tenant-architecture)

### LLM Abstraction
- [LiteLLM GitHub Repository](https://github.com/BerriAI/litellm)
- [LLM Abstraction Layer Guide (ProxAI)](https://www.proxai.co/blog/archive/llm-abstraction-layer)

### Messaging Integrations
- [WhatsApp Webhook Architecture (ChatArchitect)](https://www.chatarchitect.com/news/building-a-scalable-webhook-architecture-for-custom-whatsapp-solutions)
- [Linear Webhooks Documentation](https://linear.app/developers/webhooks)

### Coding Agents
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- [Claude Agent SDK Subagents](https://platform.claude.com/docs/en/agent-sdk/subagents)

---

*Document generated for BlockBot architecture planning. Last updated: 2026-02-05*

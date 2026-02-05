# Phase 3: LLM Infrastructure - Research

**Researched:** 2026-02-05
**Domain:** LLM Integration, Vector Database, Agent Memory Architecture
**Confidence:** MEDIUM-HIGH

## Summary

This phase implements a complete LLM infrastructure for the BlockBot agent, covering three main components: (1) LiteLLM proxy for model abstraction enabling swappable LLM providers, (2) pgvector with PostgreSQL for RAG/semantic search, and (3) a hierarchical memory system (working, episodic, semantic) for conversation persistence.

The standard approach in 2026 is to use LiteLLM as an OpenAI-compatible proxy that abstracts multiple LLM providers (Claude, GPT, local models), pgvector for vector similarity search within the existing PostgreSQL database, and a tiered memory architecture that combines recent message context (working memory), vector-indexed summaries (semantic memory), and event traces (episodic memory). The project already uses the `redis` npm package and has rate limiting infrastructure that can be extended for LLM request queuing.

Key findings indicate LiteLLM runs as a separate Docker container with OpenAI-compatible API, allowing the Bun/Hono backend to use the standard OpenAI SDK. Drizzle ORM has native pgvector support with `vector` column type and distance functions. Memory consolidation (summarizing older conversations) should happen as a background job using the existing Redis infrastructure.

**Primary recommendation:** Deploy LiteLLM as sidecar container, use OpenAI SDK for all LLM calls, implement pgvector with HNSW indexes for RAG, and build hierarchical memory with PostgreSQL + Redis for working context.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| LiteLLM | 1.x (latest stable) | LLM proxy/gateway | 100+ model support, OpenAI-compatible API, cost tracking |
| pgvector | 0.8.x | Vector similarity search | Native PostgreSQL extension, HNSW support, no separate service |
| OpenAI SDK | 4.x | LLM client | Works with LiteLLM, streaming support, TypeScript types |
| pgvector (npm) | 0.2.x | Vector utilities | toSql helper, Drizzle/Postgres.js compatible |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @langchain/textsplitters | 0.1.x | Document chunking | Splitting documents for RAG indexing |
| BullMQ | 5.x | Job queue | Background memory consolidation, rate-limited LLM calls |
| ioredis | 5.x | Redis client | Required by BullMQ (different from `redis` npm package) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LiteLLM | Direct API calls | LiteLLM adds overhead but enables model switching without code changes |
| pgvector | Pinecone/Weaviate | External service adds complexity; pgvector is "good enough" for <10M vectors |
| BullMQ | Direct Redis | BullMQ provides rate limiting, retries, and job management out-of-box |

**Installation:**
```bash
# Backend dependencies
bun add openai pgvector @langchain/textsplitters bullmq ioredis

# LiteLLM runs as Docker container, not npm package
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── features/
│   ├── llm/                    # LLM abstraction layer
│   │   ├── llm.client.ts       # OpenAI SDK wrapper for LiteLLM
│   │   ├── llm.service.ts      # Chat completion, embeddings
│   │   ├── llm.routes.ts       # /api/v1/chat endpoints
│   │   └── llm.types.ts        # Request/response types
│   ├── memory/                 # Memory management
│   │   ├── memory.service.ts   # Memory CRUD operations
│   │   ├── memory.worker.ts    # Background consolidation jobs
│   │   └── memory.types.ts     # Memory types
│   ├── rag/                    # RAG pipeline
│   │   ├── rag.service.ts      # Document indexing, retrieval
│   │   ├── rag.chunker.ts      # Text splitting utilities
│   │   └── rag.types.ts        # Embedding types
│   └── conversations/          # Conversation handling
│       ├── conversations.routes.ts
│       └── conversations.service.ts
├── shared/
│   ├── db/
│   │   └── schema/
│   │       ├── embeddings.ts       # Vector embeddings table
│   │       ├── conversations.ts    # Conversation history
│   │       └── memories.ts         # Memory entries
│   └── lib/
│       └── queue/              # BullMQ setup
│           ├── client.ts
│           └── workers.ts
```

### Pattern 1: LiteLLM Client Abstraction
**What:** Wrap OpenAI SDK configured to point at LiteLLM proxy
**When to use:** All LLM interactions (chat, embeddings)
**Example:**
```typescript
// Source: https://docs.litellm.ai/docs/proxy/user_keys
import OpenAI from 'openai';
import { env } from '../shared/lib/env';

export function createLLMClient() {
  return new OpenAI({
    apiKey: env.LITELLM_API_KEY,  // Virtual key from LiteLLM
    baseURL: env.LITELLM_URL,     // e.g., http://litellm:4000
  });
}

export async function chatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: { stream?: boolean }
) {
  const client = createLLMClient();
  return client.chat.completions.create({
    model: 'gpt-4o',  // Model name configured in LiteLLM
    messages,
    stream: options?.stream ?? false,
  });
}
```

### Pattern 2: Vector Column with Drizzle
**What:** Define embeddings table with pgvector support
**When to use:** Storing and querying document/message embeddings
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/guides/vector-similarity-search
import { index, pgTable, serial, text, uuid, vector, timestamp } from 'drizzle-orm/pg-core';

export const embeddings = pgTable(
  'embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),  // OpenAI ada-002
    sourceType: text('source_type').notNull(),  // 'conversation', 'document', 'project'
    sourceId: uuid('source_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id'),
    userId: uuid('user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('embeddingIndex').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ]
);
```

### Pattern 3: Hierarchical Memory Tables
**What:** Separate tables for different memory types with consolidation
**When to use:** Storing org/project/user scoped memories
**Example:**
```typescript
// Memory hierarchy: org -> project -> user
export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(),  // 'working', 'episodic', 'semantic'
  scope: text('scope').notNull(), // 'organization', 'project', 'user'
  organizationId: uuid('organization_id').notNull(),
  projectId: uuid('project_id'),
  userId: uuid('user_id'),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});
```

### Pattern 4: SSE Streaming Response
**What:** Stream LLM responses using Hono's streamSSE helper
**When to use:** Real-time chat responses
**Example:**
```typescript
// Source: https://hono.dev/docs/helpers/streaming
import { streamSSE } from 'hono/streaming';

app.post('/api/v1/chat', async (c) => {
  const { messages, stream } = await c.req.json();

  if (!stream) {
    const response = await chatCompletion(messages);
    return c.json(createResponse(response));
  }

  return streamSSE(c, async (sseStream) => {
    const completion = await chatCompletion(messages, { stream: true });

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        await sseStream.writeSSE({
          data: JSON.stringify({ content }),
          event: 'message',
        });
      }
    }

    await sseStream.writeSSE({ data: '[DONE]', event: 'done' });
  });
});
```

### Pattern 5: Rate-Limited LLM Queue
**What:** Use BullMQ for queuing LLM requests with rate limiting
**When to use:** Preventing rate limit errors from LLM providers
**Example:**
```typescript
// Source: https://blog.taskforce.sh/rate-limit-recipes-in-nodejs-using-bullmq/
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(env.REDIS_URL);

export const llmQueue = new Queue('llm-requests', { connection });

export const llmWorker = new Worker(
  'llm-requests',
  async (job) => {
    const { messages, userId } = job.data;
    const result = await chatCompletion(messages);
    return result;
  },
  {
    connection,
    limiter: {
      max: 60,      // Max requests
      duration: 60000, // Per minute
    },
    concurrency: 10,
  }
);

// Handle rate limit responses from API
llmWorker.on('failed', (job, err) => {
  if (err.message.includes('429')) {
    // Re-queue with delay
    llmQueue.add('chat', job.data, { delay: 60000 });
  }
});
```

### Anti-Patterns to Avoid
- **Direct LLM API calls without abstraction:** Makes model switching impossible; always use LiteLLM layer
- **Storing full conversations in working memory:** Exceeds context limits; summarize older messages
- **Creating pgvector index before data load:** Slower inserts; create HNSW index after bulk loading
- **Blocking on LLM calls in request handlers:** Use queues for non-streaming, long-running operations
- **Single embedding model without versioning:** Store model version with embeddings; re-index when model changes

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text chunking | Custom splitter | @langchain/textsplitters | Handles sentence boundaries, overlap, multiple strategies |
| Token counting | Regex/char counting | tiktoken (via LangChain) | Accurate BPE tokenization matching model's tokenizer |
| Embedding generation | Direct API calls | OpenAI SDK via LiteLLM | Batching, error handling, rate limiting built-in |
| Vector similarity | Custom distance calc | pgvector operators | Optimized C implementation, index support |
| Job queuing | Redis pub/sub | BullMQ | Retries, rate limiting, job persistence, monitoring |
| SSE streaming | Manual chunks | Hono streamSSE | Proper headers, connection management, abort handling |
| LLM fallback | Try/catch chains | LiteLLM config | Declarative fallbacks with health checks |

**Key insight:** LLM infrastructure has many subtle edge cases (token limits, rate limits, connection timeouts, partial responses) that existing libraries handle correctly. Custom solutions typically fail under production load.

## Common Pitfalls

### Pitfall 1: pgvector Post-Filtering Returns Wrong Results
**What goes wrong:** Query with `LIMIT 10` finds 10 nearest neighbors, then applies WHERE filter, returning fewer or irrelevant results
**Why it happens:** Approximate nearest neighbor search happens before SQL filtering
**How to avoid:** Use subquery pattern or increase initial limit significantly
**Warning signs:** Results don't include obviously relevant documents that match filters

```typescript
// BAD: Post-filtering
db.select().from(embeddings)
  .where(eq(embeddings.projectId, projectId))
  .orderBy(cosineDistance(embeddings.embedding, queryVector))
  .limit(10);

// GOOD: Pre-filter with larger candidate set
const candidates = db.select().from(embeddings)
  .where(eq(embeddings.projectId, projectId))
  .orderBy(cosineDistance(embeddings.embedding, queryVector))
  .limit(100);  // Get more candidates, then filter
```

### Pitfall 2: LiteLLM Database Logging Slows API
**What goes wrong:** After 1M+ logs, LLM API requests slow significantly
**Why it happens:** LiteLLM queries log database synchronously
**How to avoid:** Disable database logging in LiteLLM config, use external observability
**Warning signs:** Response times increase over days of operation

```yaml
# litellm-config.yaml
litellm_settings:
  disable_error_logs_on_db: true  # Don't log errors to DB
  success_callback: []  # Disable success callbacks
  failure_callback: []  # Use external logging instead
```

### Pitfall 3: Embedding Model Version Mismatch
**What goes wrong:** Queries return irrelevant results after model update
**Why it happens:** Old embeddings use different vector space than new model
**How to avoid:** Store model version with embeddings, re-index on model change
**Warning signs:** Search quality degrades suddenly after deployment

```typescript
// Store model info with embedding
{
  embedding: vector,
  embeddingModel: 'text-embedding-3-small',
  embeddingVersion: '2024-01',
}
```

### Pitfall 4: Context Window Overflow
**What goes wrong:** LLM returns error or truncates response
**Why it happens:** Conversation history + RAG context exceeds model's token limit
**How to avoid:** Track token count, summarize older messages, prioritize recent context
**Warning signs:** Error messages about token limits, incomplete responses

### Pitfall 5: Memory Not Scoped to Visibility
**What goes wrong:** User sees information from projects they shouldn't access
**Why it happens:** RAG retrieval doesn't respect visibility rules from Phase 2
**How to avoid:** Always filter embeddings by user's visible project/squad IDs
**Warning signs:** Cross-project information leakage in agent responses

```typescript
// ALWAYS include visibility filter
const userVisibleProjects = await getVisibleProjectIds(userId);
const results = await db.select().from(embeddings)
  .where(inArray(embeddings.projectId, userVisibleProjects))
  .orderBy(cosineDistance(embeddings.embedding, query));
```

### Pitfall 6: BullMQ Connection Exhaustion
**What goes wrong:** Redis connection errors under load
**Why it happens:** BullMQ uses ioredis, not the `redis` npm package; mixing clients
**How to avoid:** Use separate ioredis connection for BullMQ, don't share with existing redis client
**Warning signs:** Connection refused errors, "too many connections"

## Code Examples

Verified patterns from official sources:

### Generate Embeddings
```typescript
// Source: https://platform.openai.com/docs/api-reference/embeddings
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = createLLMClient();
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replaceAll('\n', ' '),
  });
  return response.data[0].embedding;
}
```

### Vector Similarity Query with Drizzle
```typescript
// Source: https://orm.drizzle.team/docs/guides/vector-similarity-search
import { cosineDistance, desc, gt, sql } from 'drizzle-orm';

export async function findSimilarDocuments(
  queryEmbedding: number[],
  projectIds: string[],
  limit = 5
) {
  const similarity = sql<number>`1 - (${cosineDistance(embeddings.embedding, queryEmbedding)})`;

  return db
    .select({
      id: embeddings.id,
      content: embeddings.content,
      similarity,
    })
    .from(embeddings)
    .where(and(
      inArray(embeddings.projectId, projectIds),
      gt(similarity, 0.7)  // Minimum similarity threshold
    ))
    .orderBy(desc(similarity))
    .limit(limit);
}
```

### Chunk Document for Indexing
```typescript
// Source: https://js.langchain.com/docs/concepts/text_splitters/
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export async function chunkDocument(text: string) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  return splitter.splitText(text);
}
```

### Memory Consolidation Job
```typescript
// Background job to summarize old conversations
export async function consolidateMemory(conversationId: string) {
  const messages = await db.select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.createdAt));

  // Keep recent N messages, summarize older ones
  const KEEP_RECENT = 10;
  if (messages.length <= KEEP_RECENT) return;

  const toSummarize = messages.slice(0, -KEEP_RECENT);
  const summary = await chatCompletion([
    { role: 'system', content: 'Summarize this conversation concisely.' },
    ...toSummarize.map(m => ({ role: m.role, content: m.content })),
  ]);

  // Store as semantic memory
  await db.insert(memories).values({
    type: 'semantic',
    scope: 'conversation',
    conversationId,
    content: summary.choices[0].message.content,
    embedding: await generateEmbedding(summary.choices[0].message.content),
  });

  // Delete summarized messages (keep summary + recent)
  await db.delete(conversationMessages)
    .where(inArray(conversationMessages.id, toSummarize.map(m => m.id)));
}
```

### LiteLLM Docker Configuration
```yaml
# docker-compose.yml addition
services:
  litellm:
    image: ghcr.io/berriai/litellm:main-v1.55.0
    ports:
      - "4000:4000"
    volumes:
      - ./litellm-config.yaml:/app/config.yaml
    environment:
      - LITELLM_MASTER_KEY=${LITELLM_MASTER_KEY}
      - LITELLM_SALT_KEY=${LITELLM_SALT_KEY}
      - DATABASE_URL=${DATABASE_URL}  # Optional: for key management
    command: ["--config", "/app/config.yaml", "--port", "4000"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health/liveliness"]
      interval: 30s
      timeout: 10s
      retries: 3
```

```yaml
# litellm-config.yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
  - model_name: claude-3-5-sonnet
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: text-embedding-3-small
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  set_verbose: false
  json_logs: true
  request_timeout: 600

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

### pgvector Migration
```sql
-- Migration: Add pgvector extension and embeddings table
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create HNSW index for fast similarity search
CREATE INDEX embedding_hnsw_idx ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index for filtering by organization/project
CREATE INDEX embeddings_org_project_idx ON embeddings (organization_id, project_id);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single embedding model | text-embedding-3-small/large with dimensions param | Jan 2024 | Cheaper, flexible dimension sizes |
| IVFFlat indexes | HNSW indexes | 2023 | Better query performance, no pre-training required |
| Fixed chunk sizes | Recursive/semantic chunking | 2024 | Better retrieval quality |
| Full conversation history | Summary + recent messages | 2024-2025 | Handles long conversations within context limits |
| Direct API calls | LLM proxy (LiteLLM) | 2024-2025 | Model switching, cost tracking, fallbacks |

**Deprecated/outdated:**
- `text-embedding-ada-002`: Replaced by text-embedding-3-small (cheaper, better)
- IVFFlat without HNSW: HNSW recommended for all new deployments
- Single-tier memory: Hierarchical memory (working/episodic/semantic) is standard

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal chunk size for this domain**
   - What we know: 200-500 tokens is general guidance
   - What's unclear: Best size for project management/conversation content
   - Recommendation: Start with 400 tokens, 50 overlap; tune based on retrieval quality

2. **Memory capacity limits per tier**
   - What we know: CONTEXT.md says "capacity-based, N entries"
   - What's unclear: Specific N values for org/project/user scopes
   - Recommendation: Start with 1000/500/100, make configurable

3. **LiteLLM vs direct SDK for embeddings**
   - What we know: LiteLLM supports embeddings endpoint
   - What's unclear: Performance overhead for high-volume embedding generation
   - Recommendation: Use LiteLLM for consistency; benchmark if issues arise

4. **BullMQ + existing Redis client coexistence**
   - What we know: BullMQ requires ioredis, project uses `redis` npm
   - What's unclear: Connection pool sizing with both clients
   - Recommendation: Keep separate connection pools, monitor total connections

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM pgvector guide](https://orm.drizzle.team/docs/guides/vector-similarity-search) - Schema, queries, indexes
- [pgvector GitHub](https://github.com/pgvector/pgvector) - Installation, operators, performance
- [LiteLLM Quick Start](https://docs.litellm.ai/docs/proxy/quick_start) - Configuration, API
- [LiteLLM Production](https://docs.litellm.ai/docs/proxy/prod) - Production settings
- [Hono Streaming Helper](https://hono.dev/docs/helpers/streaming) - SSE implementation
- [OpenAI Node SDK](https://github.com/openai/openai-node) - Client usage, streaming

### Secondary (MEDIUM confidence)
- [BullMQ Rate Limiting](https://blog.taskforce.sh/rate-limit-recipes-in-nodejs-using-bullmq/) - Queue patterns
- [pgvector-node](https://github.com/pgvector/pgvector-node) - TypeScript helpers
- [LangChain Text Splitters](https://js.langchain.com/docs/concepts/text_splitters/) - Chunking

### Tertiary (LOW confidence)
- [MarkTechPost Memory Architecture](https://www.marktechpost.com/2026/02/01/how-to-build-memory-driven-ai-agents-with-short-term-long-term-and-episodic-memory/) - Memory patterns (article content not fully extracted)
- [RAG Chunking Best Practices](https://www.pinecone.io/learn/chunking-strategies/) - Chunk size guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs verified for all core libraries
- Architecture: MEDIUM-HIGH - Patterns from official sources, memory architecture from multiple articles
- Pitfalls: HIGH - Documented issues from official sources and community reports

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable ecosystem)

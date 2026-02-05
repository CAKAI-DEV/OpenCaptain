# Phase 3: LLM Infrastructure - Context

## Overview

Implementation decisions captured through structured discussion for the LLM Infrastructure phase.

## Decisions

### Model Configuration

| Question | Decision | Rationale |
|----------|----------|-----------|
| Model specification | Per-organization setting | Each org picks their model in settings UI, allowing flexibility per customer |
| Fallback behavior | Single fallback | Primary fails → try fallback model once, then error |
| Parameters (temp, max_tokens) | Fixed defaults | System sets optimal parameters, users cannot change |
| Rate limit handling | Queue and retry | Queue requests, retry with exponential backoff when rate limited |

**Implementation notes:**
- Use LiteLLM for model abstraction (supports multiple providers)
- Store org model preference in `organizations` table
- Implement request queue with Redis for rate limit handling
- Fixed parameters simplify debugging and consistency

### Memory Architecture

| Question | Decision | Rationale |
|----------|----------|-----------|
| Persistence strategy | Summary + recent | Summarize older messages, keep recent N messages in full |
| Memory scope | Hierarchical | Org-level → Project-level → User-level memory layers |
| User access | Hidden | Memory is internal only, not exposed to users |
| Retention policy | Capacity-based | Keep up to N entries, oldest removed when limit reached |

**Implementation notes:**
- Create `conversation_memories` table with hierarchy support
- Background job to summarize old messages
- Configurable capacity limit per tier (org/project/user)
- No UI needed for memory management (hidden from users)

### Context Retrieval (RAG)

| Question | Decision | Rationale |
|----------|----------|-----------|
| RAG sources | Project + conversations + external docs | Comprehensive indexing for best context |
| Vector store | PostgreSQL (pgvector) | Use pgvector extension in existing PostgreSQL |
| Visibility handling | Hybrid | Shared project index + per-user visibility metadata for filtering |
| Index updates | Batched | Queue changes, re-index periodically (e.g., every 5 min) |

**Implementation notes:**
- Add pgvector extension to PostgreSQL
- Create `embeddings` table with vector column
- Store visibility metadata alongside embeddings
- Background job for batched re-indexing
- Support document uploads (phase 3 scope: API only, no upload UI)

### Conversation Handling

| Question | Decision | Rationale |
|----------|----------|-----------|
| Conversation scope | Cross-project | Conversations can access data from multiple projects user has access to |
| Out-of-scope handling | Politely decline | Explain limitations, suggest alternatives |
| Tool use | Supervised writes | Agent proposes changes, user must confirm before execution |
| Streaming | Optional (client choice) | API supports both streaming and non-streaming modes |

**Implementation notes:**
- Conversation context pulls from all user's visible projects
- System prompt defines scope boundaries
- Implement confirmation flow for write operations
- Support SSE for streaming, regular JSON for non-streaming

## Technical Constraints

1. **LiteLLM Integration**: Use LiteLLM proxy for model abstraction
2. **pgvector**: Requires PostgreSQL 15+ with pgvector extension
3. **Redis**: Continue using for rate limiting and request queuing
4. **Existing Auth**: Reuse JWT auth from Phase 1 for conversation endpoints

## Dependencies

- Phase 1: Auth system (JWT tokens)
- Phase 2: Projects, teams, visibility (for context scoping)

## Out of Scope (Phase 3)

- File upload UI (API only)
- Memory management UI (hidden feature)
- Real-time collaboration on conversations
- Voice/audio input

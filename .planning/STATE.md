# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Teams manage work through natural conversation with an AI that understands their project context, while admins configure workflows visually without code.
**Current focus:** Phase 4 - Tasks & Deliverables (IN PROGRESS)

## Current Position

Phase: 4 of 8 (Tasks & Deliverables)
Plan: 3 of 5 in current phase
Status: In progress
Last activity: 2026-02-06 - Completed 04-03-PLAN.md (Dependencies & Custom Fields)

Progress: [████████░░] 49%

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: 6 min
- Total execution time: 1.6 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-core-infrastructure | 3 | 20 min | 7 min |
| 02-team-access | 4 | 18 min | 5 min |
| 03-llm-infrastructure | 5 | 33 min | 7 min |
| 04-tasks-deliverables | 3 | 20 min | 7 min |

**Recent Trend:**
- Last 5 plans: 03-04 (8m), 03-05 (3m), 04-01 (6m), 04-02 (8m), 04-03 (6m)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Port 5433 for PostgreSQL to avoid local server conflicts
- Redis npm package instead of Bun native Redis for stable API
- Structured JSON logs to stdout for container-native logging
- Hono onError handler for global error handling (not middleware)
- Check error.name for ApiError detection across module boundaries
- ContentfulStatusCode type for ApiError status (Hono type compatibility)
- Sliding window rate limiting with Redis Lua script for atomicity
- Fail-open rate limiting for high availability
- Multi-stage Docker build with non-root user for security
- Traefik v3 for reverse proxy with auto SSL
- Argon2 for invitation token hashing (same as auth tokens)
- Auto-add existing users when invited (per RESEARCH recommendation)
- Timing attack prevention via dummy hash comparison on failed lookups
- Capability type derived from CAPABILITIES object keys (TypeScript pattern)
- Squad nesting limit enforced at service layer, not database constraint
- Role assignment uses upsert pattern (update if exists, insert if not)
- Default reportsTo computed by finding closest higher-tier member
- Default visibility is project-wide (unrestricted users see all)
- CASL PureAbility with raw rules for flexible authorization conditions
- Empty visibleSquadIds array means "all visible" for admin/PM/unrestricted
- visibilityMiddleware applied to all protected route files globally
- Visibility check (403) happens before existence check (404)
- pgvector/pgvector:pg16 Docker image for PostgreSQL with vector support
- 400 character chunks with 50 char overlap for RAG documents
- Empty visibleProjectIds returns no results (security-first RAG)
- 0.7 similarity threshold for cosine distance filtering
- Port 4010 for LiteLLM (4000/4001 already in use by other Docker services)
- Non-retryable errors (400/401/403/404) trigger fallback, retryable errors re-throw
- LLM client created per-request (not singleton) for flexibility
- Separate ioredis connection for BullMQ (required, prevents mixing with redis package)
- Memory capacity limits: org=1000, project=500, user=100 (capacity-based retention)
- Rate limit consolidation worker to 10/minute (prevents LLM API overload)
- HNSW index for memory embeddings (consistent with RAG embeddings)
- Keep 10 recent messages when consolidating (configurable via KEEP_RECENT_MESSAGES)
- MAX_DEPTH=2 for task nesting (0=task, 1=subtask, 2=sub-subtask)
- Status transitions: todo<->in_progress<->done (bidirectional within flow)
- Auto-set completedAt timestamp on status change to/from done
- JSONB for deliverable type config (statuses, transitions, fields)
- Status validation at service layer (not database) for flexibility
- completedAt auto-managed based on isFinal status flag
- Polymorphic dependencies via type+id columns, not foreign keys
- DFS cycle detection at service layer (not database constraint)
- Field type changes prevented after creation (400 error)
- Custom fields can apply to tasks, deliverables, or both

### Pending Todos

None yet.

### Blockers/Concerns

None - Plan 04-03 complete. Ready for Plan 04-04 (Metrics).

## Session Continuity

Last session: 2026-02-06T17:42:26Z
Stopped at: Completed 04-03-PLAN.md (Dependencies & Custom Fields)
Resume file: None

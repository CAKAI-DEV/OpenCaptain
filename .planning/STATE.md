# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Teams manage work through natural conversation with an AI that understands their project context, while admins configure workflows visually without code.
**Current focus:** Phase 5 - Messaging Channels (COMPLETE)

## Current Position

Phase: 5 of 8 (Messaging Channels)
Plan: 4 of 4 in current phase
Status: Phase complete
Last activity: 2026-02-05 - Completed 05-04-PLAN.md (Comments API)

Progress: [█████████████████░░] 91%

## Performance Metrics

**Velocity:**
- Total plans completed: 21
- Average duration: 6 min
- Total execution time: 2.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-core-infrastructure | 3 | 20 min | 7 min |
| 02-team-access | 4 | 18 min | 5 min |
| 03-llm-infrastructure | 5 | 33 min | 7 min |
| 04-tasks-deliverables | 4 | 26 min | 7 min |
| 05-messaging-channels | 4 | 9 min | 2 min |

**Recent Trend:**
- Last 5 plans: 04-04 (6m), 05-01 (2m), 05-03 (4m), 05-04 (3m)
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
- S3 env vars optional - uploads return 503 when not configured (graceful degradation)
- Attachment status lifecycle: pending -> completed/failed
- Presigned URLs: 1 hour for upload, 7 days for download
- Metrics computed on-demand via raw SQL (no materialized views yet)
- Polymorphic targets for comments/notifications using targetType+targetId columns (consistent with dependencies)
- Optional messaging env vars (Telegram/WhatsApp) - features gracefully degrade when not configured
- WhatsApp SDK: @great-detail/whatsapp for Cloud API integration
- WhatsApp webhook signature verification via HMAC SHA256 with x-hub-signature-256
- Always return 200 OK to Meta webhooks (per Meta requirement)
- @mentions resolved by email within organization scope
- buildVisibilityContext pattern for routes needing visibleProjectIds
- Telegram bot uses getQueueConnection() for Redis sessions (same ioredis as BullMQ)
- Deep link format connect_{userId} for Telegram account linking

### Pending Todos

None yet.

### Blockers/Concerns

None - Phase 05 complete, ready for Phase 06 (Dashboard).

## Session Continuity

Last session: 2026-02-05T19:34:53Z
Stopped at: Completed 05-02-PLAN.md (Telegram Bot Integration) [parallel with 05-03, 05-04]
Resume file: None

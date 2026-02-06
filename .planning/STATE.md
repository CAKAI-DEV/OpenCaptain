# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Teams manage work through natural conversation with an AI that understands their project context, while admins configure workflows visually without code.
**Current focus:** Phase 6 - Check-ins and Escalations (IN PROGRESS)

## Current Position

Phase: 6 of 8 (Check-ins and Escalations)
Plan: 2 of 4 in current phase
Status: In progress
Last activity: 2026-02-06 - Completed 06-02-PLAN.md (Recap Generation)

Progress: [██████████████████████████░░] 87% through Phase 6

## Performance Metrics

**Velocity:**
- Total plans completed: 26
- Average duration: 6 min
- Total execution time: 2.6 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-core-infrastructure | 3 | 20 min | 7 min |
| 02-team-access | 4 | 18 min | 5 min |
| 03-llm-infrastructure | 5 | 33 min | 7 min |
| 04-tasks-deliverables | 4 | 26 min | 7 min |
| 05-messaging-channels | 7 | 22 min | 3 min |
| 06-check-ins-escalations | 2 | 10 min | 5 min |

**Recent Trend:**
- Last 5 plans: 05-06 (5m), 05-07 (4m), 06-01 (5m), 06-02 (5m)
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
- queueNotification function abstracts BullMQ queue.add for clean separation
- Intent detection via LLM function calling (gpt-4o-mini for speed/cost)
- User context persistence via userMessaging.lastProjectId
- Complex queries (create_task, etc.) route to conversation service
- Proactive messages respect user preferences (dailyCheckinEnabled, weeklyRecapEnabled)
- Messages delivered via both Telegram and WhatsApp if both verified
- BullMQ repeatable jobs for scheduled proactive messaging (9 AM daily, 9 AM Monday)
- Role-based scope determination: Admin/PM=project, Squad lead=squad, Member=personal
- LLM fallback to metrics summary when LLM call fails
- Recurring recaps: daily at 6 PM, weekly on Friday 5 PM

### Pending Todos

None yet.

### Blockers/Concerns

None - Plan 06-02 complete. Ready for Plan 06-03.

## Session Continuity

Last session: 2026-02-06T06:18:48Z
Stopped at: Completed 06-02-PLAN.md (Recap Generation)
Resume file: None

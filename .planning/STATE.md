# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Teams manage work through natural conversation with an AI that understands their project context, while admins configure workflows visually without code.
**Current focus:** Phase 7 - Web UI & Analytics (IN PROGRESS)

## Current Position

Phase: 7 of 8 (Web UI & Analytics)
Plan: 4 of 9 in current phase (07-01, 07-02, 07-03, 07-04 complete)
Status: In progress
Last activity: 2026-02-06 - Completed 07-04-PLAN.md (Kanban Board)

Progress: [██████████████████████████░░░] 80% of Phase 7

## Performance Metrics

**Velocity:**
- Total plans completed: 30
- Average duration: 6 min
- Total execution time: 2.85 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-core-infrastructure | 3 | 20 min | 7 min |
| 02-team-access | 4 | 18 min | 5 min |
| 03-llm-infrastructure | 5 | 33 min | 7 min |
| 04-tasks-deliverables | 4 | 26 min | 7 min |
| 05-messaging-channels | 7 | 22 min | 3 min |
| 06-check-ins-escalations | 3 | 18 min | 6 min |
| 07-web-ui-analytics | 4 | 15 min | 4 min |

**Recent Trend:**
- Last 5 plans: 07-01 (5m), 07-02 (5m), 07-03 (2m), 07-04 (3m)
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
- Escalation notifications delivered via messaging but not stored in notifications table
- BullMQ delayed jobs for escalation step scheduling
- Escalation routing follows reportsToUserId chain from project_members
- HTTP-only cookies for JWT storage (XSS protection)
- Next.js API routes proxy to backend and manage cookies
- Middleware redirects unauthenticated users to /login with callbackUrl
- Port 3001 for web dev server (avoids conflict with API on 3000)
- Next.js 16 with Tailwind 4 (latest stable versions)
- shadcn/ui new-york-v4 style for component library
- Nested layouts for dashboard/project context separation
- HealthCard colored dots: -10% threshold healthy, -30% threshold warning
- Project selector only shown when projectId in URL params
- dnd-kit for drag-and-drop (over react-beautiful-dnd)
- React 19 useOptimistic for instant UI updates with automatic rollback
- Server Component fetches initial tasks, Client Component handles DnD

### Pending Todos

None yet.

### Blockers/Concerns

None - Phase 7 in progress.

## Session Continuity

Last session: 2026-02-06T10:46:32Z
Stopped at: Completed 07-04-PLAN.md (Kanban Board)
Resume file: None

---
phase: "08"
plan: "02"
subsystem: integrations
tags: [linear, webhooks, sync, graphql]
dependency-graph:
  requires: ["04-tasks-deliverables"]
  provides: ["linear-integration", "bidirectional-sync", "webhook-handler"]
  affects: ["08-03-github"]
tech-stack:
  added: ["@linear/sdk"]
  patterns: ["webhook-signature-verification", "last-write-wins-sync", "idempotency-keys"]
key-files:
  created:
    - src/features/integrations/linear/linear.types.ts
    - src/features/integrations/linear/linear.client.ts
    - src/features/integrations/linear/linear.sync.ts
    - src/features/integrations/linear/linear.webhooks.ts
    - src/features/integrations/linear/linear.routes.ts
    - src/features/integrations/linear/index.ts
    - src/shared/db/schema/linear-sync.ts
  modified:
    - src/shared/db/schema/index.ts
    - src/features/tasks/tasks.service.ts
    - src/index.ts
    - src/shared/lib/env.ts
    - src/features/messaging/messaging.service.ts
decisions:
  - id: linear-sdk
    choice: "@linear/sdk"
    rationale: "Official TypeScript SDK with strongly-typed methods"
  - id: sync-strategy
    choice: "last-write-wins"
    rationale: "Simple, predictable conflict resolution using timestamps"
  - id: webhook-verification
    choice: "HMAC SHA256 with timing-safe comparison"
    rationale: "Prevents timing attacks on signature verification"
  - id: idempotency
    choice: "Redis with 5-minute TTL"
    rationale: "Prevents duplicate webhook processing"
metrics:
  duration: "9 min"
  completed: "2026-02-06"
---

# Phase 08 Plan 02: Linear Integration Summary

Bidirectional sync between BlockBot tasks and Linear issues using webhooks and SDK.

## One-Liner

Linear SDK client with bidirectional task sync, HMAC webhook verification, and last-write-wins conflict resolution.

## What Was Built

### Linear Client (`linear.client.ts`)
- `createLinearClient(apiKey)` - Creates typed Linear SDK client
- `createLinearIssue(client, params)` - Creates issue with priority mapping
- `updateLinearIssue(client, issueId, updates)` - Updates existing issue
- `getLinearIssue(client, issueId)` - Retrieves issue for sync verification
- `getLinearTeamStates(client, teamId)` - Gets workflow states for status mapping
- `getLinearTeams(client)` - Lists accessible teams
- `LinearRateLimitError` - Custom error with retry-after information

### Bidirectional Sync (`linear.sync.ts`)
- `syncTaskToLinear(task, client, teamId, mappings)` - Creates/updates Linear issues
- `syncFromLinear(webhookData, projectId, mappings)` - Updates local tasks from webhooks
- `getLinearIntegration(projectId)` - Gets project's Linear config
- `getLinearSyncMetadata(taskId)` - Gets sync status for a task
- Last-write-wins conflict resolution comparing `updatedAt` timestamps
- Status mapping: todo/in_progress/done to Linear workflow states
- Priority mapping: low/medium/high/urgent to Linear 0-4 scale

### Webhook Handler (`linear.webhooks.ts`)
- `verifyLinearWebhook(body, signature, secret)` - HMAC SHA256 with timing-safe comparison
- `handleLinearWebhook(c)` - Async webhook processing with immediate 200 response
- Idempotency via Redis to prevent duplicate processing
- Handles Issue create/update/remove events

### API Routes (`linear.routes.ts`)
- `POST /webhooks/linear` - Webhook receiver (signature verified, no auth)
- `POST /api/v1/projects/:projectId/integrations/linear` - Configure integration
- `GET /api/v1/projects/:projectId/integrations/linear` - Get integration status
- `DELETE /api/v1/projects/:projectId/integrations/linear` - Disable integration
- `POST /api/v1/tasks/:taskId/sync-linear` - Manual sync trigger
- `GET /api/v1/tasks/:taskId/linear-status` - Get sync status

### Database Schema (`linear-sync.ts`)
- `linearIntegrations` table: projectId, apiKeyEncrypted, teamId, statusMappings (JSONB), enabled
- `linearSyncMetadata` table: taskId, linearIssueId, linearTeamId, lastSyncedAt, syncDirection

### Task Service Hooks
- Auto-sync to Linear on task create (if integration enabled)
- Auto-sync to Linear on task update (if integration enabled)
- `skipLinearSync` option to prevent infinite loops during webhook handling

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Linear SDK | @linear/sdk | Official TypeScript SDK, strongly typed |
| Sync strategy | Last-write-wins | Simple, predictable, no queue management |
| Webhook verification | HMAC SHA256 + timing-safe | Prevents timing attacks |
| Idempotency | Redis with 5-min TTL | Prevents duplicate webhook processing |
| Status mapping | Configurable per-project | Teams can customize state mapping |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed type error in messaging.service.ts**
- **Found during:** Task 2 typecheck
- **Issue:** `days[i]` could be undefined in array iteration
- **Fix:** Added null check before `hint.includes(day)`
- **Files modified:** src/features/messaging/messaging.service.ts
- **Commit:** 3a4f23a

## Commits

| Hash | Description |
|------|-------------|
| 5c342cf | feat(08-02): create Linear client and sync schema |
| 3a4f23a | feat(08-02): implement bidirectional sync service |
| 812bd56 | feat(08-02): add Linear routes and task hooks |

## Files Changed

### Created
- `src/features/integrations/linear/linear.types.ts` - Type definitions
- `src/features/integrations/linear/linear.client.ts` - SDK wrapper
- `src/features/integrations/linear/linear.sync.ts` - Sync service
- `src/features/integrations/linear/linear.webhooks.ts` - Webhook handler
- `src/features/integrations/linear/linear.routes.ts` - API routes
- `src/features/integrations/linear/index.ts` - Module exports
- `src/shared/db/schema/linear-sync.ts` - Database schema

### Modified
- `src/shared/db/schema/index.ts` - Added linear-sync export
- `src/features/tasks/tasks.service.ts` - Added Linear sync hooks
- `src/index.ts` - Mounted Linear routes
- `src/shared/lib/env.ts` - Added LINEAR_WEBHOOK_SECRET
- `package.json` - Added @linear/sdk dependency

## Verification Results

- [x] `bun run typecheck` passes
- [x] `bun run lint` passes
- [x] Linear SDK installed in package.json
- [x] Webhook endpoint verifies signature before processing
- [x] Task create/update triggers Linear sync when integration enabled
- [x] Last-write-wins conflict resolution implemented

## Next Phase Readiness

Ready for Plan 03 (GitHub Integration):
- Integration pattern established (client + sync + webhooks + routes)
- Database schema pattern for external service correlation
- Webhook verification pattern can be reused for GitHub

---
type: summary
phase: "06"
plan: "03"
subsystem: escalations
tags: [escalations, blockers, deadline-monitoring, bullmq, messaging]
dependency-graph:
  requires: ["06-01", "06-02", "05-messaging"]
  provides: [escalation-blocks, blockers, deadline-monitor, report-blocker-intent]
  affects: ["07-workflow-automation"]
tech-stack:
  added: []
  patterns: [time-windowed-escalation-chains, delayed-job-scheduling, reports-to-routing]
key-files:
  created:
    - src/shared/db/schema/escalation-blocks.ts
    - src/shared/db/schema/blockers.ts
    - src/shared/db/migrations/0014_escalations.sql
    - src/features/escalations/escalations.types.ts
    - src/features/escalations/escalations.service.ts
    - src/features/escalations/escalations.worker.ts
    - src/features/escalations/deadline-monitor.worker.ts
    - src/features/escalations/escalations.routes.ts
    - src/features/escalations/index.ts
  modified:
    - src/shared/db/schema/index.ts
    - src/shared/lib/queue/client.ts
    - src/features/notifications/notifications.types.ts
    - src/features/notifications/notifications.service.ts
    - src/features/notifications/notifications.worker.ts
    - src/features/messaging/messaging.intents.ts
    - src/features/messaging/messaging.types.ts
    - src/features/messaging/messaging.service.ts
    - src/index.ts
decisions:
  - id: escalation-notification-type
    choice: "Escalation notifications delivered via messaging but not stored in notifications table"
    reason: "Escalation alerts are transient and don't need in-app notification persistence"
  - id: time-windowed-escalation
    choice: "BullMQ delayed jobs for escalation step scheduling"
    reason: "Consistent with existing check-in and recap scheduling patterns"
  - id: reports-to-routing
    choice: "Escalation routing follows reportsToUserId chain from project_members"
    reason: "Natural escalation path in organizational hierarchy"
metrics:
  duration: 8 min
  completed: "2026-02-06"
---

# Phase 6 Plan 3: Escalation System Summary

**One-liner:** Time-windowed escalation chains with blocker reporting, deadline monitoring, and output threshold alerts using BullMQ delayed jobs.

## What Was Built

### Database Schema

**escalation_blocks table:**
- Trigger types: `blocker_reported`, `deadline_risk`, `output_below_threshold`
- Time-windowed routing via `escalation_steps` JSONB array
- Targeting: all, squad, or role-based
- Configuration: `deadline_warning_days`, `output_threshold`, `output_period_days`

**blockers table:**
- User-reported obstacles with task linkage
- Status lifecycle: open -> in_progress -> resolved/cancelled
- Resolution tracking with resolver and notes

**escalation_instances table:**
- Active escalation chain tracking
- Current step position in chain
- Status: active, resolved, cancelled

### Escalation Chain System

**EscalationStep structure:**
```typescript
{
  delayMinutes: number;  // 0 = immediate, 240 = 4hr, 1440 = 24hr
  routeType: 'reports_to' | 'role' | 'user';
  routeRole?: string;    // For role-based routing
  routeUserId?: string;  // For direct user routing
  message?: string;      // Optional custom message
}
```

**Routing logic:**
- `reports_to`: Follows reportsToUserId chain from project_members
- `role`: Notifies all users with specified role in project
- `user`: Notifies specific user

### Workers

**escalations.worker.ts:**
- Processes delayed escalation jobs
- Sends notifications at each step
- Schedules next step in chain
- Handles step completion

**deadline-monitor.worker.ts:**
- Checks deadline risks every 4 hours
- Checks output thresholds daily at 9 AM
- Creates escalation instances for at-risk items
- Scans tasks and deliverables approaching deadlines

### Messaging Integration

**New intent: report_blocker**
- Triggers on: "I'm blocked", "stuck on", "can't proceed", "waiting on"
- Extracts: blockerDescription entity
- Creates blocker and triggers escalation chain

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/escalations/projects/:projectId/escalation-blocks | List escalation blocks |
| POST | /api/v1/escalations/projects/:projectId/escalation-blocks | Create escalation block |
| GET | /api/v1/escalations/projects/:projectId/escalation-blocks/:blockId | Get escalation block |
| PATCH | /api/v1/escalations/projects/:projectId/escalation-blocks/:blockId | Update escalation block |
| DELETE | /api/v1/escalations/projects/:projectId/escalation-blocks/:blockId | Delete escalation block |
| GET | /api/v1/escalations/projects/:projectId/blockers | List blockers |
| POST | /api/v1/escalations/projects/:projectId/blockers | Report blocker |
| GET | /api/v1/escalations/projects/:projectId/blockers/:blockerId | Get blocker |
| POST | /api/v1/escalations/projects/:projectId/blockers/:blockerId/resolve | Resolve blocker |
| GET | /api/v1/escalations/projects/:projectId/escalations | Get active escalations |
| GET | /api/v1/escalations/projects/:projectId/my-escalations | Get my active escalations |

## Architecture Decisions

### Escalation Notification Handling
Escalation alerts are delivered via Telegram/WhatsApp but not stored in the notifications table. This is because:
1. Escalation alerts are transient and action-oriented
2. The escalation_instances table tracks escalation state
3. Reduces notification table clutter

### Time-Windowed Scheduling
Uses BullMQ's delay feature for scheduling escalation steps:
```typescript
await escalationQueue.add(name, data, {
  delay: delayMinutes * 60 * 1000,
  jobId: `escalation-${instanceId}-${timestamp}`,
});
```

### Deduplication
Before creating escalation instances, checks for existing active escalations:
- For blockers: By blocker ID
- For deadlines: By task ID
- For output thresholds: By user ID

## Key Code Patterns

### Triggering Escalation Chain
```typescript
// On blocker report
await triggerBlockerEscalation(projectId, blockerId, reportedById);

// Finds matching escalation blocks
// Creates escalation instance
// Schedules first step
```

### Processing Escalation Step
```typescript
// Worker processes delayed job
// Resolves recipients based on routeType
// Sends notifications via queueNotification
// Updates currentStep
// Schedules next step if exists
```

### Blocker Resolution Cancellation
```typescript
// Resolving blocker cancels active escalations
await cancelBlockerEscalations(blockerId);
// Sets status='cancelled' on all active instances
```

## Deviations from Plan

### Extended Notification Types
Added 'escalation' to notification types and updated notifications worker to handle escalation-type notifications differently (deliver only, don't store).

**Rationale:** Clean separation between persistent in-app notifications and transient escalation alerts.

## Commits

| Hash | Description |
|------|-------------|
| 6834daa | feat(06-03): create escalation and blocker schemas with migration |
| d56df39 | feat(06-03): create escalation service and worker |
| e04b554 | feat(06-03): add deadline monitor, routes, and messaging integration |

## Verification

- [x] bun run typecheck passes
- [x] bun run lint passes
- [x] Escalation blocks support all trigger types
- [x] Time-windowed routing chains functional
- [x] Blocker reporting via messaging works
- [x] Deadline monitor scheduled for periodic checks
- [x] Routes registered and workers started

## Next Phase Readiness

Phase 6 Plan 4 (Templates) can proceed. Escalation system provides:
- Escalation block configuration schema
- Time-windowed routing infrastructure
- Blocker and deadline monitoring

Potential integration points for templates:
- Pre-configured escalation chains
- Common blocker categories
- Role-based routing presets

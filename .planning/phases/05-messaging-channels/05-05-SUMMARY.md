---
phase: 05-messaging-channels
plan: 05
subsystem: notifications
tags: [bullmq, notifications, telegram, whatsapp, comments]

dependency_graph:
  requires: [05-02, 05-03, 05-04]
  provides: [notification-queue, notification-worker, notification-api, mention-notifications]
  affects: []

tech_stack:
  added: []
  patterns: [notification-queue-worker, messaging-delivery, polymorphic-targets]

key_files:
  created:
    - src/features/notifications/notifications.types.ts
    - src/features/notifications/notifications.service.ts
    - src/features/notifications/notifications.worker.ts
    - src/features/notifications/notifications.routes.ts
    - src/features/notifications/index.ts
  modified:
    - src/shared/lib/queue/client.ts
    - src/features/comments/comments.service.ts
    - src/index.ts

decisions:
  - key: notification-service-queueing
    choice: queueNotification function abstracts BullMQ queue.add
    rationale: Clean separation between caller and queue implementation

metrics:
  duration: 4 min
  completed: 2026-02-05
---

# Phase 05 Plan 05: Notifications System Summary

BullMQ notification queue with Telegram/WhatsApp delivery and @mention integration.

## What Was Built

### Notification Types and Service
- **NotificationType**: `mention`, `comment`, `assignment`, `status_change`, `due_soon`
- **queueNotification**: Queues notification job to BullMQ with 3 retry attempts
- **storeNotification**: Persists notification to database
- **getUserNotifications**: Raw SQL join fetching actor email, target title, project name
- **getUnreadCount**: Count unread notifications for user
- **markNotificationRead**: Mark single notification as read
- **markAllRead**: Bulk mark all user notifications as read

### Notification Worker
- BullMQ worker with concurrency of 10
- Stores notification to database first
- Checks user messaging preferences (messagingEnabled flag)
- Builds human-readable message based on notification type
- Delivers via Telegram if telegramChatId + telegramVerified
- Delivers via WhatsApp if whatsappPhone + whatsappVerified
- Graceful shutdown registration via registerWorker

### REST API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/notifications | List user's notifications (unreadOnly, limit, offset) |
| GET | /api/v1/notifications/unread-count | Get unread notification count |
| PATCH | /api/v1/notifications/:id/read | Mark notification as read |
| POST | /api/v1/notifications/read-all | Mark all as read |

### Comments Integration
- On comment creation, queue `mention` notification for each @mentioned user (except author)
- On comment creation, queue `comment` notification for item assignee (if not author and not mentioned)
- Supports both task and deliverable targets via targetType field

## Technical Decisions

1. **Barrel export import for Telegram**: Worker imports `sendTelegramMessage` from `'../telegram'` barrel export, not directly from handlers (per RESEARCH.md Pattern 8)

2. **Notification message building**: Human-readable messages like "john mentioned you in a comment on 'Fix login bug'"

3. **Actor name from email prefix**: Uses email prefix (before @) as display name for notifications

4. **Silent messaging failure**: If Telegram/WhatsApp delivery fails, error is logged but notification is still stored

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] GET /api/v1/notifications returns user's notifications
- [x] GET /api/v1/notifications/unread-count returns count
- [x] PATCH /api/v1/notifications/:id/read marks as read
- [x] POST /api/v1/notifications/read-all marks all as read
- [x] Creating comment with @mention queues notification
- [x] Worker stores notification and delivers via messaging
- [x] sendTelegramMessage imported from '../telegram' (barrel export)
- [x] bun run typecheck passes

## Commits

| Hash | Description |
|------|-------------|
| 45bce30 | feat(05-05): create notifications types and service |
| 0abe9f3 | feat(05-05): create notifications worker with messaging delivery |
| 49d7915 | feat(05-05): create routes and integrate with comments |

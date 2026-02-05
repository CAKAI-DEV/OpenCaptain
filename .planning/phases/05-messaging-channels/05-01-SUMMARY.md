---
# Summary Metadata
phase: 05-messaging-channels
plan: 01
subsystem: database
tags: [schema, messaging, comments, notifications, drizzle]

# Dependency Graph
requires: [04]
provides: [user_messaging, comments, notifications]
affects: [05-02, 05-03, 05-04]

# Tech Tracking
tech-stack:
  added: []
  patterns: [polymorphic-targets]

# File Tracking
key-files:
  created:
    - src/shared/db/schema/user-messaging.ts
    - src/shared/db/schema/comments.ts
    - src/shared/db/schema/notifications.ts
    - src/shared/db/migrations/0012_awesome_zodiak.sql
  modified:
    - src/shared/db/schema/index.ts
    - src/shared/lib/env.ts

# Decisions
decisions:
  - id: msg-schema-01
    choice: "Polymorphic targets for comments and notifications using targetType+targetId columns"
    rationale: "Consistent with dependencies pattern from Phase 4, allows referencing both tasks and deliverables"

# Metrics
duration: 2 min
completed: 2026-02-05
---

# Phase 05 Plan 01: Foundation Schemas Summary

Foundation database schemas for messaging channels with user preferences, comments with @mentions, and notification tracking.

## What Was Built

### User Messaging Table (`user_messaging`)
- One-to-one relationship with users (unique userId constraint)
- Telegram connection fields: chatId, username, verified flag
- WhatsApp connection fields: phone, verified flag
- Preference flags: messagingEnabled, dailyCheckinEnabled, weeklyRecapEnabled
- lastProjectId for context tracking (no FK - may reference deleted projects)
- Indexes on telegramChatId and whatsappPhone for webhook lookups

### Comments Table (`comments`)
- Polymorphic target using targetType ('task' | 'deliverable') + targetId
- Content with resolved @mentions stored as user ID array (JSONB)
- Author reference with cascade delete
- Composite index on (targetType, targetId) for listing comments on items
- Index on projectId for project-scoped queries

### Notifications Table (`notifications`)
- User notifications with type discriminator ('mention' | 'comment' | 'assignment' | 'status_change' | 'due_soon')
- Actor reference (nullable for system notifications, set null on delete)
- Polymorphic target (targetType, targetId) + projectId reference
- Optional commentId for mention/comment notifications
- Read state tracking
- Index on (userId, read) for unread count queries
- Index on (userId, createdAt) for feed pagination

### Environment Variables
- `TELEGRAM_BOT_TOKEN` - optional, messaging disabled if not configured
- `WHATSAPP_ACCESS_TOKEN` - optional
- `WHATSAPP_PHONE_NUMBER_ID` - optional
- `WHATSAPP_VERIFY_TOKEN` - optional
- `WHATSAPP_APP_SECRET` - optional

## Key Patterns Applied

1. **Polymorphic targets**: Same pattern as Phase 4 dependencies - targetType + targetId columns instead of multiple foreign keys
2. **Optional messaging services**: Following S3 pattern - env vars are optional, features gracefully degrade
3. **No FK for lastProjectId**: May reference deleted projects, avoids cleanup complexity

## Commits

| Commit | Description |
|--------|-------------|
| 08af1ac | feat(05-01): add user-messaging schema |
| 4be6653 | feat(05-01): add comments and notifications schemas |
| 3ea9d47 | feat(05-01): update schema exports and add messaging env vars |

## Files Changed

**Created:**
- `src/shared/db/schema/user-messaging.ts` - User messaging preferences and platform connections
- `src/shared/db/schema/comments.ts` - Comments with polymorphic targets and @mentions
- `src/shared/db/schema/notifications.ts` - Notification tracking with read state
- `src/shared/db/migrations/0012_awesome_zodiak.sql` - Migration file

**Modified:**
- `src/shared/db/schema/index.ts` - Added exports for new schemas
- `src/shared/lib/env.ts` - Added optional Telegram and WhatsApp env vars

## Verification Results

- [x] All three schema files exist and export correctly
- [x] `bun run typecheck` passes with no errors
- [x] `bun run db:migrate` applies schemas to database (tables verified via psql)
- [x] Environment variables are optional (app starts without them)
- [x] All 118 existing tests pass

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for:**
- 05-02: Telegram bot integration (userMessaging schema available)
- 05-03: WhatsApp integration (userMessaging schema available)
- 05-04: Comments service (comments schema available)
- 05-05: Notifications worker (notifications schema available)

**No blockers identified.**

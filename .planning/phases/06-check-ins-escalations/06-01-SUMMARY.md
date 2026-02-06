---
phase: "06"
plan: "01"
completed: "2026-02-06"
duration: "6m"
subsystem: check-ins
tags: [bullmq, cron, scheduling, messaging, templates, zod]

dependencies:
  requires:
    - 05-messaging-channels # For Telegram and WhatsApp delivery
  provides:
    - Check-in block configuration schema
    - Preset check-in templates (daily_standup, output_count, weekly_forecast)
    - BullMQ worker for scheduled check-in delivery
    - Admin API for check-in CRUD operations
  affects:
    - 06-02 (escalations may reference check-in responses)
    - Future analytics on check-in completion rates

tech-stack:
  added: []
  patterns:
    - BullMQ repeatable jobs with cron pattern and timezone support
    - JSONB questions array for flexible check-in configuration
    - buildVisibilityContext pattern for project-scoped routes

key-files:
  created:
    - src/shared/db/schema/check-in-blocks.ts
    - src/shared/db/schema/check-in-responses.ts
    - src/shared/db/migrations/0013_check_ins.sql
    - src/features/check-ins/check-ins.types.ts
    - src/features/check-ins/check-ins.templates.ts
    - src/features/check-ins/check-ins.service.ts
    - src/features/check-ins/check-ins.worker.ts
    - src/features/check-ins/check-ins.routes.ts
    - src/features/check-ins/index.ts
  modified:
    - src/shared/db/schema/index.ts
    - src/shared/db/schema/squad-members.ts
    - src/shared/lib/queue/client.ts
    - src/shared/db/migrations/meta/_journal.json
    - src/index.ts

decisions:
  - key: questions-jsonb
    choice: Store questions as JSONB array in check_in_blocks table
    rationale: Flexible schema for different question types without additional tables
  - key: cron-timezone
    choice: BullMQ repeatable jobs with timezone support (tz option)
    rationale: Users expect check-ins delivered in their project's timezone
  - key: dual-channel-delivery
    choice: Deliver to both Telegram and WhatsApp if both verified
    rationale: Maximize reach - users may have preferences on different devices
---

# Phase 06 Plan 01: Check-in Blocks and Delivery Summary

Admin-configurable check-in blocks with scheduled delivery via messaging channels.

## One-liner

BullMQ-scheduled check-in prompts with JSONB questions, cron patterns, and Telegram/WhatsApp delivery.

## What Was Built

### Database Schema (Task 1)

**check_in_blocks table:**
- Stores check-in configuration (name, description, cron pattern, timezone)
- JSONB questions array supporting text, number, select, boolean types
- Targeting options: all users, specific squad, or specific role
- Template reference for preset configurations

**check_in_responses table:**
- Tracks individual user responses to check-in prompts
- Status lifecycle: pending -> completed | skipped
- JSONB responses array for question answers

### Templates and Service (Task 2)

**Preset Templates:**
1. `daily_standup` - Classic standup (yesterday, today, blockers) at 9 AM weekdays
2. `output_count` - Deliverable tracking (count, blocked) at 5 PM weekdays
3. `weekly_forecast` - Week reflection and planning at 4 PM Friday

**Service Functions:**
- CRUD operations for check-in blocks
- `scheduleCheckInBlock()` - Creates BullMQ repeatable jobs for target users
- `cancelCheckInBlockJobs()` - Removes scheduled jobs when block disabled/deleted
- `formatCheckInPrompt()` - Converts questions to readable message
- `getTargetUsers()` - Resolves targeting to user list with messaging prefs

### Worker and Routes (Task 3)

**BullMQ Worker:**
- Processes scheduled check-in jobs
- Delivers via Telegram and WhatsApp (dual-channel if both verified)
- Records check-in sent in responses table

**Admin API Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/check-ins/templates | List available templates |
| GET | /api/v1/check-ins/templates/:id | Get template with questions |
| GET | /api/v1/check-ins/projects/:projectId/check-in-blocks | List project blocks |
| POST | /api/v1/check-ins/projects/:projectId/check-in-blocks | Create block |
| GET | /api/v1/check-ins/projects/:projectId/check-in-blocks/:id | Get block |
| PATCH | /api/v1/check-ins/projects/:projectId/check-in-blocks/:id | Update block |
| DELETE | /api/v1/check-ins/projects/:projectId/check-in-blocks/:id | Delete block |

## Commits

| Hash | Description |
|------|-------------|
| 68481df | feat(06-01): add check-in blocks and responses schema |
| 43951a9 | feat(06-01): add check-in types, templates, and service |
| 3082d8b | feat(06-01): add check-in worker, routes, and integration |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed squadMembers missing relations**
- **Found during:** Task 2 (typecheck failure)
- **Issue:** recaps.service.ts used `with: { user: ... }` on squadMembers query but relations weren't defined
- **Fix:** Added squadMembersRelations with squad and user relations to squad-members.ts
- **Files modified:** src/shared/db/schema/squad-members.ts
- **Commit:** 43951a9

## Verification Results

- [x] Migration creates check_in_blocks and check_in_responses tables
- [x] GET /api/v1/check-ins/templates returns available templates
- [x] GET /api/v1/check-ins/templates/:id returns template with fresh question IDs
- [x] POST /api/v1/check-ins/projects/:projectId/check-in-blocks creates block
- [x] GET /api/v1/check-ins/projects/:projectId/check-in-blocks lists blocks
- [x] PATCH /api/v1/check-ins/projects/:projectId/check-in-blocks/:id updates block
- [x] DELETE /api/v1/check-ins/projects/:projectId/check-in-blocks/:id deletes block
- [x] BullMQ repeatable jobs scheduled with timezone support
- [x] Worker delivers check-in prompts via Telegram/WhatsApp
- [x] bun run typecheck and bun run lint pass

## Next Phase Readiness

**Phase 6 Plan 2 (Escalations):** Ready to proceed
- Check-in responses table available for escalation triggers
- Worker infrastructure reusable for escalation delivery
- No blockers identified

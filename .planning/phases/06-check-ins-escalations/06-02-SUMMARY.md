---
phase: 06-check-ins-escalations
plan: 02
subsystem: recaps
tags: [recaps, llm, role-based, bullmq, scheduled-jobs]
dependency-graph:
  requires: [06-01]
  provides: [recap-generation, role-based-recaps, scheduled-recaps]
  affects: [06-03, 06-04]
tech-stack:
  added: []
  patterns: [role-based-context, llm-fallback, scheduled-delivery]
key-files:
  created:
    - src/features/recaps/recaps.types.ts
    - src/features/recaps/recaps.service.ts
    - src/features/recaps/recaps.worker.ts
    - src/features/recaps/recaps.routes.ts
    - src/features/recaps/index.ts
  modified:
    - src/shared/lib/queue/client.ts
    - src/index.ts
decisions:
  - title: "Role-based scope determination"
    rationale: "Admin/PM get project-wide, squad leads get squad-wide, members get personal"
    pattern: "determineRecapScope using buildVisibilityContext"
  - title: "LLM fallback to metrics"
    rationale: "When LLM fails, still provide useful summary with raw metrics"
    pattern: "try LLM -> catch -> buildFallbackRecap"
  - title: "Recurring recap schedule"
    rationale: "Daily at 6 PM, weekly on Friday 5 PM"
    pattern: "BullMQ repeatable jobs with cron patterns"
metrics:
  duration: "5m"
  completed: "2026-02-06"
---

# Phase 06 Plan 02: Recap Generation Summary

Role-based recap generation with LLM-powered summaries tailored to each recipient's visibility level and scheduled delivery via BullMQ.

## One-liner

Role-based recap generation (personal/squad/project scope) with LLM summaries and scheduled delivery via Telegram/WhatsApp

## What Was Built

### 1. Recap Types (recaps.types.ts)

- `RecapScope`: 'personal' | 'squad' | 'project'
- `RecapPeriod`: 'daily' | 'weekly'
- `PersonalMetrics`: tasks/deliverables completed, in-progress count
- `SquadMetrics`: team velocity, per-person breakdown
- `ProjectMetrics`: by-squad breakdown, daily trend, at-risk deadlines
- `RecapContext`: full context for LLM generation
- `generateRecapSchema`: Zod validation for API

### 2. Recap Service (recaps.service.ts)

- `determineRecapScope()`: Uses `buildVisibilityContext` to determine user's role
  - Admin/PM -> project scope
  - Squad lead -> squad scope
  - Member -> personal scope
- `buildPersonalMetrics()`: Individual tasks/deliverables completed in period
- `buildSquadMetrics()`: Team velocity, per-person breakdown using SQL join
- `buildProjectMetrics()`: By-squad breakdown, daily trend, at-risk deadlines
- `buildRecapContext()`: Aggregates all context for LLM
- `generateRecap()`: LLM-powered summary with fallback to metrics
- `buildFallbackRecap()`: Simple metrics when LLM fails

### 3. Recap Worker (recaps.worker.ts)

- `recapWorker`: BullMQ worker for processing recap jobs
- `deliverRecapMessage()`: Delivers via Telegram and/or WhatsApp
- `queueRecap()`: Queue single recap for delivery
- `scheduleProjectRecaps()`: Queue recaps for all project members
- `scheduleRecurringRecaps()`: Set up daily/weekly cron schedules

### 4. Recap Routes (recaps.routes.ts)

- `POST /api/v1/recaps/generate`: Generate recap on-demand
- `POST /api/v1/recaps/preview`: Get recap context without LLM
- `POST /api/v1/recaps/queue`: Queue recap for delivery
- `POST /api/v1/recaps/projects/:id/enable-recurring`: Enable scheduled recaps

## Key Implementation Details

### Role-Based Scope Determination

```typescript
export async function determineRecapScope(userId, projectId, organizationId): Promise<RecapScope> {
  const visibility = await buildVisibilityContext(userId, organizationId);

  if (visibility.isAdmin || visibility.isPM) return 'project';

  const membership = await db.query.projectMembers.findFirst({
    where: and(eq(userId), eq(projectId)),
  });

  if (membership?.role === 'squad_lead') return 'squad';

  return 'personal';
}
```

### LLM Prompt Generation by Scope

- **Personal**: Focuses on individual achievements, tasks completed, upcoming priorities
- **Squad**: Focuses on team velocity, per-person breakdown, blockers
- **Project**: Focuses on strategic insights, by-squad comparison, at-risk deadlines

### Scheduled Delivery

```typescript
// Daily at 6 PM
await recapQueue.add('daily-recap', data, {
  repeat: { pattern: '0 18 * * *' },
  jobId: `daily-recap-${userId}-${projectId}`,
});

// Weekly on Friday 5 PM
await recapQueue.add('weekly-recap', data, {
  repeat: { pattern: '0 17 * * 5' },
  jobId: `weekly-recap-${userId}-${projectId}`,
});
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Admin/PM get project scope | They need strategic overview of all squads |
| Squad leads get squad scope | They need team performance metrics |
| LLM fallback to metrics | Always provide value even if LLM fails |
| Daily at 6 PM | End of workday summary |
| Weekly on Friday 5 PM | Week wrap-up before weekend |
| Use buildVisibilityContext | Consistent role determination across features |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Squad members query lacks relations**

- **Found during:** Task 1
- **Issue:** squadMembers table has no Drizzle relations defined, causing TypeScript error
- **Fix:** Used raw SQL join instead of Drizzle `with` clause
- **Files modified:** src/features/recaps/recaps.service.ts
- **Commit:** 81daa85

## Commit Log

| Hash | Message |
|------|---------|
| 81daa85 | feat(06-02): add recap types and context builder |
| 41eaf86 | feat(06-02): add recap worker and routes |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/recaps/generate | Generate recap on-demand (LLM) |
| POST | /api/v1/recaps/preview | Get recap context without LLM |
| POST | /api/v1/recaps/queue | Queue recap for delivery |
| POST | /api/v1/recaps/projects/:id/enable-recurring | Enable scheduled recaps |

## Files Changed

### Created
- `src/features/recaps/recaps.types.ts` - Type definitions and Zod schemas
- `src/features/recaps/recaps.service.ts` - Recap generation logic
- `src/features/recaps/recaps.worker.ts` - BullMQ worker and scheduling
- `src/features/recaps/recaps.routes.ts` - API routes
- `src/features/recaps/index.ts` - Barrel export

### Modified
- `src/shared/lib/queue/client.ts` - Added recapQueue
- `src/index.ts` - Registered routes and worker import

## Next Phase Readiness

**Blockers:** None

**Ready for:** Plan 06-03 (Blockers and Escalations)

**Integration points established:**
- `generateRecap` exported for external use
- `queueRecap` for programmatic scheduling
- Role-based context building pattern reusable

---
phase: 05-messaging-channels
plan: 06
subsystem: messaging
completed: "2026-02-05"
duration: 5 min
tags:
  - nlu
  - intent-detection
  - llm-function-calling
  - context-management
  - messaging

dependency-graph:
  requires:
    - "05-02" # Telegram bot integration
    - "05-03" # WhatsApp integration
  provides:
    - intent-detection-service
    - context-management
    - unified-message-processor
  affects:
    - "06" # Dashboard phase (messaging stats)

tech-stack:
  added: []
  patterns:
    - LLM function calling for intent classification
    - User context persistence via userMessaging table
    - Unified processing pipeline for multi-platform messaging

key-files:
  created:
    - src/features/messaging/messaging.types.ts
    - src/features/messaging/messaging.intents.ts
    - src/features/messaging/messaging.context.ts
    - src/features/messaging/messaging.service.ts
    - src/features/messaging/index.ts
  modified:
    - src/features/telegram/telegram.handlers.ts
    - src/features/whatsapp/whatsapp.handlers.ts

decisions:
  - key: intent-detection-model
    choice: gpt-4o-mini
    rationale: Smaller, faster model sufficient for intent classification
  - key: intent-classification-method
    choice: LLM function calling
    rationale: Structured output guaranteed, better than regex or keyword matching
  - key: context-persistence
    choice: userMessaging.lastProjectId
    rationale: Reuses existing table, persists across sessions

metrics:
  tasks_completed: 3
  commits: 3
  files_created: 5
  files_modified: 2
---

# Phase 5 Plan 6: Natural Language Understanding Summary

## One-Liner

LLM-powered intent detection with function calling enabling "what's due this week" queries and project context switching.

## What Was Built

### 1. Intent Detection Service (`messaging.intents.ts`)

Uses OpenAI-compatible function calling to classify user messages into intents:

- **query_tasks**: "what's due this week?", "show my tasks"
- **query_status**: "squad status", "project progress"
- **create_task**: "create task X", "add task"
- **update_task**: "mark X as done", "complete task"
- **switch_project**: "switch to [project]", "/switch"
- **help**: "help", "what can you do?"
- **general_chat**: General conversation
- **unknown**: Unclassified

Extracts entities: projectName, taskTitle, timeRange, status, priority, assignee.

### 2. Context Management (`messaging.context.ts`)

- **getUserContext**: Loads user's org, current project, and visible projects
- **switchProject**: Updates lastProjectId with visibility validation
- **getAvailableProjects**: Lists projects user can switch to

### 3. Message Processor (`messaging.service.ts`)

Main entry point `processMessage(userId, message, platform)`:

- Simple intents (query_tasks, switch_project, help) handled directly
- Complex intents (create_task, update_task, query_status) routed to conversation service
- Task queries support timeRange: today, this_week, this_month, overdue

### 4. Platform Integration

Both Telegram and WhatsApp handlers now route through unified pipeline:

```typescript
const result = await processMessage(userId, message.text, 'telegram');
await ctx.reply(result.response);
```

## Key Implementation Details

### Intent Classification Flow

```
User Message
    |
    v
detectIntent(message, orgId)
    |
    v
OpenAI Function Calling (gpt-4o-mini)
    |
    v
{intent, entities, confidence}
    |
    v
Route to Handler
```

### Task Query Response Example

```
User: "What's due this week?"

Response:
Here are your tasks due this week:

- Review API design doc (Mon, Feb 3)
- Complete auth tests (Wed, Feb 5)
- Deploy staging (Fri, Feb 7)
```

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Intent model | gpt-4o-mini | Fast, cheap, sufficient for classification |
| Classification method | Function calling | Guaranteed structured JSON output |
| Context storage | userMessaging.lastProjectId | Reuses existing schema |
| Complex queries | Route to conversation service | Leverages RAG and memory |

## Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| messaging.types.ts | 55 | Intent, Entities, IntentResult, MessageContext types |
| messaging.intents.ts | 135 | LLM function calling for intent detection |
| messaging.context.ts | 98 | User context management and project switching |
| messaging.service.ts | 211 | Unified message processing with intent routing |
| messaging/index.ts | 23 | Barrel exports |

## Commits

1. `c3d565d` - feat(05-06): implement intent detection with LLM function calling
2. `fcaadd7` - feat(05-06): implement context management and message processor
3. `116aa2f` - feat(05-06): integrate NLU pipeline with Telegram and WhatsApp

## Deviations from Plan

None - plan executed exactly as written.

## Verification Checklist

- [x] Intent detection classifies "what's due this week" as query_tasks
- [x] Intent detection classifies "switch to ProjectX" as switch_project
- [x] Context manager retrieves and updates user project context
- [x] Task queries return relevant tasks based on time range
- [x] Project switching works via natural language
- [x] Both Telegram and WhatsApp use processMessage
- [x] bun run typecheck passes
- [x] bun run test passes (118 pass, 2 skip, 0 fail)

## Next Phase Readiness

Phase 5 (Messaging Channels) is now complete with all 6 plans:

1. 05-01: Schema and routing
2. 05-02: Telegram bot integration
3. 05-03: WhatsApp integration
4. 05-04: Comments API
5. 05-05: Notifications worker
6. 05-06: Natural language understanding

Ready to proceed to Phase 6 (Dashboard).

# Phase 6: Check-ins & Escalations - Research

**Researched:** 2026-02-06
**Domain:** Scheduled check-ins, recap generation, escalation routing, blocker management
**Confidence:** MEDIUM-HIGH

## Summary

This phase builds on the proactive messaging infrastructure from Phase 5 to implement admin-configurable check-in blocks, role-based recap generation, and time-windowed escalation chains. The existing BullMQ worker, messaging delivery infrastructure, and role hierarchy provide the foundation for this work.

The standard approach uses: (1) "block" tables storing check-in and escalation configurations with JSONB for flexible question/trigger schemas, (2) BullMQ repeatable jobs for scheduled check-ins with per-user timezone support, (3) LLM-based recap generation with role/visibility-aware prompts, (4) a new "blockers" table with escalation state tracking, and (5) time-based escalation routing using delayed BullMQ jobs that traverse the role hierarchy (member -> squad_lead -> pm -> admin).

Key findings indicate that BullMQ supports `tz` option for timezone-aware cron patterns, enabling per-user scheduling. Escalation routing should use delayed jobs with automatic cancellation when blockers are resolved. The existing role tier system (admin=0, pm=1, squad_lead=2, member=3) provides the escalation chain hierarchy. Check-in responses should be processed via the existing NLU pipeline with a new `report_blocker` intent.

**Primary recommendation:** Create `check_in_blocks`, `escalation_blocks`, and `blockers` tables. Extend the proactive messaging worker for scheduled check-ins. Use delayed BullMQ jobs for time-windowed escalation chains that follow the reportsToUserId hierarchy.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | 5.x | Scheduled jobs with timezone support | Already in use; supports `tz` option in repeat config |
| Drizzle ORM | 0.35.x | Database schema and queries | Already in use; JSONB support for flexible configs |
| Zod | 3.x | Config schema validation | Already in use; validate check-in questions, trigger configs |
| dayjs | 1.x | Date manipulation | Already in use; timezone-aware date calculations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dayjs/plugin/timezone | 1.x | Timezone support | Per-user check-in scheduling |
| dayjs/plugin/utc | 1.x | UTC conversions | Normalize times for comparison |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Delayed BullMQ jobs for escalation | cron-based polling | BullMQ delayed jobs are more efficient, auto-cancel on resolution |
| JSONB for questions/triggers | Normalized tables | JSONB is simpler for admin-defined flexible schemas |
| Role hierarchy for escalation chain | Configurable chains | Use existing reportsToUserId; simpler for v1 |

**Installation:**
```bash
# No new dependencies needed - all libraries already installed
bun add dayjs  # If not already present (likely is)
```

## Architecture Patterns

### Recommended Project Structure
```
src/features/
├── check-ins/                    # Check-in blocks and scheduling
│   ├── __tests__/
│   ├── check-ins.types.ts        # Block and response types
│   ├── check-ins.service.ts      # Block CRUD, scheduling
│   ├── check-ins.worker.ts       # Scheduled job processor
│   ├── check-ins.routes.ts       # Admin API for blocks
│   └── check-ins.templates.ts    # Preset templates (standup, etc.)
├── recaps/                       # Recap generation
│   ├── __tests__/
│   ├── recaps.types.ts           # Recap types
│   ├── recaps.service.ts         # Role-based recap generation
│   └── recaps.worker.ts          # Scheduled recap delivery
├── escalations/                  # Escalation blocks and routing
│   ├── __tests__/
│   ├── escalations.types.ts      # Block, blocker, chain types
│   ├── escalations.service.ts    # Block CRUD, blocker management
│   ├── escalations.worker.ts     # Delayed escalation job processor
│   └── escalations.routes.ts     # Admin API + blocker endpoints
└── messaging/                    # Existing - extend
    ├── messaging.intents.ts      # Add report_blocker intent
    └── messaging.service.ts      # Handle blocker reports

src/shared/db/schema/
├── check-in-blocks.ts            # Check-in configuration
├── check-in-responses.ts         # User responses to check-ins
├── escalation-blocks.ts          # Escalation configuration
└── blockers.ts                   # Reported blockers with state
```

### Pattern 1: Check-in Block Configuration
**What:** Admin creates check-in blocks with scheduled frequency and custom questions
**When to use:** CHCK-01, CHCK-02
**Example:**
```typescript
// src/shared/db/schema/check-in-blocks.ts
import { boolean, jsonb, pgTable, timestamp, uuid, varchar, integer } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const checkInBlocks = pgTable('check_in_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id),

  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 1000 }),

  // Scheduling
  cronPattern: varchar('cron_pattern', { length: 50 }).notNull(), // '0 9 * * 1-5'
  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),

  // Questions (ordered array)
  questions: jsonb('questions').$type<CheckInQuestion[]>().notNull(),

  // Template reference (null = custom)
  templateId: varchar('template_id', { length: 50 }), // 'daily_standup', 'output_count', 'weekly_forecast'

  // Targeting
  targetType: varchar('target_type', { length: 20 }).notNull(), // 'all' | 'squad' | 'role'
  targetSquadId: uuid('target_squad_id'),
  targetRole: varchar('target_role', { length: 50 }),

  enabled: boolean('enabled').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Type for questions JSONB
interface CheckInQuestion {
  id: string;
  text: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  options?: string[]; // For select type
  required: boolean;
}
```

### Pattern 2: Scheduled Check-in Delivery
**What:** BullMQ worker sends check-in prompts at scheduled times per user timezone
**When to use:** CHCK-03
**Example:**
```typescript
// src/features/check-ins/check-ins.worker.ts
import { Worker, Queue } from 'bullmq';
import { getQueueConnection } from '../../shared/lib/queue/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const checkInQueue = new Queue('check-ins', {
  connection: getQueueConnection(),
});

interface CheckInJobData {
  type: 'send_check_in';
  checkInBlockId: string;
  userId: string;
}

export const checkInWorker = new Worker<CheckInJobData>(
  'check-ins',
  async (job) => {
    const { checkInBlockId, userId } = job.data;

    // Get check-in block with questions
    const block = await db.query.checkInBlocks.findFirst({
      where: eq(schema.checkInBlocks.id, checkInBlockId),
    });

    if (!block || !block.enabled) return;

    // Format questions as message
    const message = formatCheckInPrompt(block.name, block.questions);

    // Deliver via messaging infrastructure
    await deliverMessage(userId, message);

    // Track that check-in was sent (for response matching)
    await db.insert(schema.checkInResponses).values({
      checkInBlockId,
      userId,
      status: 'pending',
      sentAt: new Date(),
    });
  },
  { connection: getQueueConnection() }
);

/**
 * Schedule check-ins for all eligible users of a block
 */
export async function scheduleCheckInBlock(blockId: string): Promise<void> {
  const block = await db.query.checkInBlocks.findFirst({
    where: eq(schema.checkInBlocks.id, blockId),
  });

  if (!block || !block.enabled) return;

  // Get target users based on targeting config
  const users = await getTargetUsers(block);

  for (const user of users) {
    // Get user's timezone preference
    const userTz = await getUserTimezone(user.id) || block.timezone;

    await checkInQueue.add(
      `check-in-${block.id}-${user.id}`,
      { type: 'send_check_in', checkInBlockId: block.id, userId: user.id },
      {
        repeat: {
          pattern: block.cronPattern,
          tz: userTz, // BullMQ timezone support
        },
        jobId: `check-in-${block.id}-${user.id}`,
      }
    );
  }
}
```

### Pattern 3: Role-Based Recap Generation
**What:** Generate recap summaries tailored to recipient's role and visibility level
**When to use:** CHCK-05, CHCK-06
**Example:**
```typescript
// src/features/recaps/recaps.service.ts
import { chatCompletionForOrg } from '../llm';
import { getOutputMetrics, getPersonalMetrics } from '../metrics';
import { buildVisibilityContext } from '../visibility';

type RecapScope = 'personal' | 'squad' | 'project';

interface RecapContext {
  scope: RecapScope;
  period: 'daily' | 'weekly';
  metrics: OutputMetrics | PersonalMetrics;
  blockers: Array<{ title: string; reportedAt: Date; status: string }>;
  upcomingDeadlines: Array<{ title: string; dueDate: Date }>;
}

/**
 * Generate a recap tailored to recipient's role
 */
export async function generateRecap(
  userId: string,
  projectId: string,
  organizationId: string,
  period: 'daily' | 'weekly'
): Promise<string> {
  // Determine scope based on user's role
  const visibility = await buildVisibilityContext(userId, organizationId);
  const userRole = await getUserRole(userId, projectId);

  let scope: RecapScope;
  if (visibility.isPM || visibility.isAdmin) {
    scope = 'project';
  } else if (userRole === 'squad_lead') {
    scope = 'squad';
  } else {
    scope = 'personal';
  }

  // Build recap context with role-appropriate data
  const context = await buildRecapContext(userId, projectId, scope, period);

  // Generate with LLM
  const prompt = buildRecapPrompt(scope, period, context);
  const result = await chatCompletionForOrg(organizationId, [
    { role: 'system', content: RECAP_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]);

  return result.content;
}

const RECAP_SYSTEM_PROMPT = `You are a project management assistant generating recap summaries.
Be concise but highlight important patterns. Use bullet points.
For personal recaps: focus on individual achievements and upcoming work.
For squad recaps: focus on team velocity, blockers, and collaboration.
For project recaps: focus on overall progress, risks, and strategic insights.`;

function buildRecapPrompt(scope: RecapScope, period: string, ctx: RecapContext): string {
  const periodLabel = period === 'daily' ? 'today' : 'this week';

  switch (scope) {
    case 'personal':
      return `Generate a ${period} personal recap for ${periodLabel}:
Completed: ${ctx.metrics.totalCompleted} tasks
Upcoming deadlines: ${ctx.upcomingDeadlines.length}
Active blockers: ${ctx.blockers.length}
Keep it brief (3-5 bullet points).`;

    case 'squad':
      return `Generate a ${period} squad recap for ${periodLabel}:
Team output: ${ctx.metrics.totalCompleted} items completed
By person: ${JSON.stringify(ctx.metrics.byPerson)}
Active blockers: ${ctx.blockers.map(b => b.title).join(', ')}
Focus on team patterns and blockers needing attention.`;

    case 'project':
      return `Generate a ${period} project recap for ${periodLabel}:
Total output: ${ctx.metrics.totalCompleted} items
By squad: ${JSON.stringify(ctx.metrics.bySquad)}
Velocity trend: ${JSON.stringify(ctx.metrics.byDay)}
Critical blockers: ${ctx.blockers.filter(b => b.status === 'escalated').length}
Provide strategic insights and highlight risks.`;
  }
}
```

### Pattern 4: Escalation Block Configuration
**What:** Admin creates escalation blocks with triggers and time-windowed routing
**When to use:** ESCL-01, ESCL-02, ESCL-03
**Example:**
```typescript
// src/shared/db/schema/escalation-blocks.ts
import { jsonb, pgTable, timestamp, uuid, varchar, boolean } from 'drizzle-orm/pg-core';

export const escalationBlocks = pgTable('escalation_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id),

  name: varchar('name', { length: 255 }).notNull(),

  // Trigger configuration
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
    // 'blocker_reported' | 'deadline_risk' | 'output_below_threshold'
  triggerConfig: jsonb('trigger_config').$type<TriggerConfig>().notNull(),

  // Escalation chain (time-windowed routing)
  escalationChain: jsonb('escalation_chain').$type<EscalationStep[]>().notNull(),

  enabled: boolean('enabled').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Trigger config types
type TriggerConfig =
  | { type: 'blocker_reported' } // Any blocker triggers
  | { type: 'deadline_risk'; daysBeforeDue: number; minProgress: number }
  | { type: 'output_below_threshold'; periodDays: number; minOutput: number };

// Escalation chain step
interface EscalationStep {
  delayMinutes: number;    // 0 = immediate, 240 = 4 hours, 1440 = 24 hours
  targetType: 'role' | 'user' | 'reports_to';
  targetRole?: 'squad_lead' | 'pm' | 'admin';  // For role targeting
  targetUserId?: string;    // For specific user targeting
  // 'reports_to' uses the blocker reporter's reportsToUserId chain
}

// Example escalation chain: 4hr -> squad lead, 24hr -> PM
const exampleChain: EscalationStep[] = [
  { delayMinutes: 0, targetType: 'reports_to' },      // Immediate: notify manager
  { delayMinutes: 240, targetType: 'role', targetRole: 'squad_lead' },  // 4hr: squad lead
  { delayMinutes: 1440, targetType: 'role', targetRole: 'pm' },         // 24hr: PM
];
```

### Pattern 5: Blocker Tracking and Resolution
**What:** Track reported blockers with escalation state
**When to use:** ESCL-04, ESCL-05
**Example:**
```typescript
// src/shared/db/schema/blockers.ts
import { pgTable, timestamp, uuid, varchar, text, integer } from 'drizzle-orm/pg-core';

export const blockers = pgTable('blockers', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // Who reported and what it blocks
  reportedById: uuid('reported_by_id')
    .notNull()
    .references(() => users.id),

  // What is blocked (polymorphic)
  targetType: varchar('target_type', { length: 20 }).notNull(), // 'task' | 'deliverable'
  targetId: uuid('target_id').notNull(),

  // Blocker details
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),

  // State
  status: varchar('status', { length: 20 }).notNull().default('open'),
    // 'open' | 'escalated' | 'resolved'
  resolvedById: uuid('resolved_by_id').references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),

  // Escalation tracking
  currentEscalationStep: integer('current_escalation_step').default(0).notNull(),
  lastEscalatedAt: timestamp('last_escalated_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// src/features/escalations/escalations.service.ts
export async function reportBlocker(input: ReportBlockerInput): Promise<string> {
  // Create blocker record
  const [blocker] = await db.insert(schema.blockers)
    .values({
      projectId: input.projectId,
      reportedById: input.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      title: input.title,
      description: input.description,
    })
    .returning();

  // Find applicable escalation blocks
  const escalationBlocks = await db.query.escalationBlocks.findMany({
    where: and(
      eq(schema.escalationBlocks.projectId, input.projectId),
      eq(schema.escalationBlocks.triggerType, 'blocker_reported'),
      eq(schema.escalationBlocks.enabled, true),
    ),
  });

  // Start escalation chain for each block
  for (const block of escalationBlocks) {
    await startEscalationChain(blocker.id, block);
  }

  return blocker.id;
}

export async function resolveBlocker(
  blockerId: string,
  resolvedById: string
): Promise<void> {
  await db.update(schema.blockers)
    .set({
      status: 'resolved',
      resolvedById,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.blockers.id, blockerId));

  // Cancel pending escalation jobs
  await cancelEscalationJobs(blockerId);
}
```

### Pattern 6: Time-Windowed Escalation Routing
**What:** Delayed jobs that traverse escalation chain, cancelled on resolution
**When to use:** ESCL-03
**Example:**
```typescript
// src/features/escalations/escalations.worker.ts
import { Worker, Queue } from 'bullmq';
import { getQueueConnection } from '../../shared/lib/queue/client';

export const escalationQueue = new Queue('escalations', {
  connection: getQueueConnection(),
});

interface EscalationJobData {
  type: 'escalate';
  blockerId: string;
  escalationBlockId: string;
  stepIndex: number;
}

export const escalationWorker = new Worker<EscalationJobData>(
  'escalations',
  async (job) => {
    const { blockerId, escalationBlockId, stepIndex } = job.data;

    // Check if blocker still exists and is unresolved
    const blocker = await db.query.blockers.findFirst({
      where: eq(schema.blockers.id, blockerId),
    });

    if (!blocker || blocker.status === 'resolved') {
      logger.info({ blockerId }, 'Blocker resolved, skipping escalation');
      return;
    }

    // Get escalation block config
    const block = await db.query.escalationBlocks.findFirst({
      where: eq(schema.escalationBlocks.id, escalationBlockId),
    });

    if (!block || !block.enabled) return;

    const step = block.escalationChain[stepIndex];
    if (!step) return;

    // Find escalation target
    const targetUserId = await resolveEscalationTarget(
      step,
      blocker.reportedById,
      blocker.projectId
    );

    if (targetUserId) {
      // Send escalation notification
      const message = await formatEscalationMessage(blocker, stepIndex);
      await deliverMessage(targetUserId, message);

      // Update blocker state
      await db.update(schema.blockers)
        .set({
          status: 'escalated',
          currentEscalationStep: stepIndex,
          lastEscalatedAt: new Date(),
        })
        .where(eq(schema.blockers.id, blockerId));
    }

    // Schedule next step if exists
    const nextStep = block.escalationChain[stepIndex + 1];
    if (nextStep) {
      await escalationQueue.add(
        `escalate-${blockerId}-${stepIndex + 1}`,
        {
          type: 'escalate',
          blockerId,
          escalationBlockId,
          stepIndex: stepIndex + 1,
        },
        {
          delay: nextStep.delayMinutes * 60 * 1000,
          jobId: `escalate-${blockerId}-${stepIndex + 1}`,
        }
      );
    }
  },
  { connection: getQueueConnection() }
);

/**
 * Resolve escalation target based on step config
 */
async function resolveEscalationTarget(
  step: EscalationStep,
  reporterId: string,
  projectId: string
): Promise<string | null> {
  switch (step.targetType) {
    case 'reports_to': {
      // Follow reportsToUserId chain from reporter
      const reporter = await db.query.projectMembers.findFirst({
        where: and(
          eq(schema.projectMembers.userId, reporterId),
          eq(schema.projectMembers.projectId, projectId),
        ),
      });
      return reporter?.reportsToUserId || null;
    }

    case 'role': {
      // Find first user with target role in project
      const member = await db.query.projectMembers.findFirst({
        where: and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.role, step.targetRole!),
        ),
      });
      return member?.userId || null;
    }

    case 'user':
      return step.targetUserId || null;
  }
}

/**
 * Start escalation chain for a blocker
 */
export async function startEscalationChain(
  blockerId: string,
  block: EscalationBlock
): Promise<void> {
  if (block.escalationChain.length === 0) return;

  const firstStep = block.escalationChain[0];

  // Schedule first step (may be immediate if delayMinutes = 0)
  await escalationQueue.add(
    `escalate-${blockerId}-0`,
    {
      type: 'escalate',
      blockerId,
      escalationBlockId: block.id,
      stepIndex: 0,
    },
    {
      delay: firstStep.delayMinutes * 60 * 1000,
      jobId: `escalate-${blockerId}-0`,
    }
  );
}

/**
 * Cancel all pending escalation jobs for a blocker
 */
export async function cancelEscalationJobs(blockerId: string): Promise<void> {
  // Get all delayed jobs with matching prefix
  const delayed = await escalationQueue.getDelayed();

  for (const job of delayed) {
    if (job.data.blockerId === blockerId) {
      await job.remove();
      logger.info({ jobId: job.id, blockerId }, 'Cancelled escalation job');
    }
  }
}
```

### Pattern 7: Proactive Deadline Risk Detection
**What:** Agent monitors for deadline risk and triggers escalations
**When to use:** ESCL-06
**Example:**
```typescript
// src/features/escalations/deadline-monitor.worker.ts

interface DeadlineCheckJobData {
  type: 'check_deadlines';
  projectId: string;
}

/**
 * Check for deadline risks and trigger escalations
 * Run periodically (e.g., every 4 hours)
 */
async function checkDeadlineRisks(projectId: string): Promise<void> {
  // Get escalation blocks with deadline_risk trigger
  const blocks = await db.query.escalationBlocks.findMany({
    where: and(
      eq(schema.escalationBlocks.projectId, projectId),
      eq(schema.escalationBlocks.triggerType, 'deadline_risk'),
      eq(schema.escalationBlocks.enabled, true),
    ),
  });

  for (const block of blocks) {
    const config = block.triggerConfig as {
      type: 'deadline_risk';
      daysBeforeDue: number;
      minProgress: number;
    };

    // Find at-risk deliverables
    const now = new Date();
    const riskDate = dayjs(now).add(config.daysBeforeDue, 'day').toDate();

    const atRiskItems = await db.query.deliverables.findMany({
      where: and(
        eq(schema.deliverables.projectId, projectId),
        lte(schema.deliverables.dueDate, riskDate),
        // Not in final status
        ne(schema.deliverables.status, 'done'),
        ne(schema.deliverables.status, 'published'),
      ),
    });

    for (const item of atRiskItems) {
      // Check if already escalated recently
      const existing = await db.query.blockers.findFirst({
        where: and(
          eq(schema.blockers.targetType, 'deliverable'),
          eq(schema.blockers.targetId, item.id),
          eq(schema.blockers.status, 'escalated'),
          gte(schema.blockers.createdAt, dayjs(now).subtract(24, 'hour').toDate()),
        ),
      });

      if (existing) continue;

      // Create system-generated blocker
      await reportBlocker({
        projectId,
        userId: item.assigneeId || item.createdById,
        targetType: 'deliverable',
        targetId: item.id,
        title: `Deadline risk: "${item.title}" due soon with no progress`,
        description: `This deliverable is due on ${dayjs(item.dueDate).format('MMM D')} but hasn't progressed.`,
      });
    }
  }
}
```

### Pattern 8: Blocker Intent in Messaging
**What:** Extend NLU to detect blocker reports via chat
**When to use:** ESCL-04
**Example:**
```typescript
// Extend messaging.intents.ts INTENT_FUNCTION

// Add to intent enum:
'report_blocker', // "I'm blocked on X", "Stuck on Y", "Can't proceed with Z"

// Add to entities:
blockerDescription: { type: 'string', description: 'What is blocking the user' },
blockedItem: { type: 'string', description: 'Task or deliverable that is blocked' },

// Update system prompt to include:
`- report_blocker: User reporting they are blocked ("I'm stuck on", "blocked by", "can't proceed")`

// In messaging.service.ts, add handler:
case 'report_blocker': {
  if (!context.currentProjectId) {
    return { response: "Please select a project first to report a blocker." };
  }

  // Extract what's blocked
  const title = intent.entities.blockerDescription
    || intent.entities.blockedItem
    || message;

  // Create blocker
  const blockerId = await reportBlocker({
    projectId: context.currentProjectId,
    userId: context.userId,
    targetType: 'task', // Default, could be improved with entity extraction
    targetId: 'unknown', // Would need task lookup
    title: title.slice(0, 500),
  });

  return {
    response: `Blocker reported! Your manager and team leads will be notified.`
  };
}
```

### Anti-Patterns to Avoid
- **Polling for escalation timing:** Use BullMQ delayed jobs, not cron-based polling
- **Ignoring user timezones for check-ins:** Use BullMQ `tz` option for per-user scheduling
- **Hardcoded escalation chains:** Store in database for admin configurability
- **Not cancelling escalations on resolution:** Always cancel pending jobs when blocker resolved
- **One-size-fits-all recaps:** Tailor content to recipient's role and visibility level
- **Synchronous escalation chains:** Process each step as a separate delayed job

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduled job timing | Manual setTimeout/cron | BullMQ repeatable with `tz` | Persistence, timezone support, reliability |
| Delayed escalation execution | Custom delay logic | BullMQ delayed jobs | Built-in cancellation, persistence across restarts |
| Role hierarchy traversal | Custom graph walking | Existing reportsToUserId chain | Already modeled, tested |
| Recap content generation | Template strings | LLM with role-aware prompts | Natural language, context-aware insights |
| Check-in question rendering | Custom format per type | Generic question->message transformer | Flexibility for new question types |
| Timezone calculations | Manual offset math | dayjs with timezone plugin | DST handling, IANA timezone support |

**Key insight:** BullMQ provides the exact primitives needed: repeatable jobs with timezone support for check-ins, delayed jobs with cancellation for escalation chains. The existing role hierarchy and messaging infrastructure handle routing.

## Common Pitfalls

### Pitfall 1: Escalation Race Conditions
**What goes wrong:** Blocker resolved but escalation job already processing
**Why it happens:** Job dequeued before resolution, check happens after
**How to avoid:** Always check blocker status at job execution time, not just scheduling
**Warning signs:** Escalation notifications for already-resolved blockers

### Pitfall 2: Check-in Timezone Drift
**What goes wrong:** Check-ins arrive at wrong time after DST change
**Why it happens:** Using fixed offsets instead of IANA timezone names
**How to avoid:** Store timezone as 'America/New_York' not '-05:00', use dayjs/timezone
**Warning signs:** Users complaining about timing shift twice a year

### Pitfall 3: Recap Data Visibility Leak
**What goes wrong:** Member sees squad-wide metrics in their recap
**Why it happens:** Not checking role before building recap context
**How to avoid:** Always use buildVisibilityContext before gathering recap data
**Warning signs:** Users see others' metrics they shouldn't have access to

### Pitfall 4: Escalation Chain Storms
**What goes wrong:** Single blocker triggers hundreds of notifications
**Why it happens:** Multiple escalation blocks, each with multiple steps
**How to avoid:** Rate limit notifications per blocker, dedupe targets
**Warning signs:** Managers receiving many duplicate escalation alerts

### Pitfall 5: Stale Check-in Schedules
**What goes wrong:** Users still receive check-ins after being removed from project
**Why it happens:** Scheduled jobs not cancelled when membership changes
**How to avoid:** Listen for membership changes, cancel/reschedule jobs
**Warning signs:** Former project members still receiving check-ins

### Pitfall 6: Output Threshold False Positives
**What goes wrong:** Vacationing users trigger low-output escalations
**Why it happens:** No consideration of user availability or working days
**How to avoid:** Add optional "excluded dates" or "active" flag to threshold checks
**Warning signs:** Escalations during known holidays/PTO

## Code Examples

### Check-in Template Presets
```typescript
// src/features/check-ins/check-ins.templates.ts
import { v4 as uuid } from 'uuid';

export const CHECK_IN_TEMPLATES = {
  daily_standup: {
    name: 'Daily Standup',
    questions: [
      { id: uuid(), text: 'What did you accomplish yesterday?', type: 'text', required: true },
      { id: uuid(), text: 'What are you working on today?', type: 'text', required: true },
      { id: uuid(), text: 'Any blockers or concerns?', type: 'text', required: false },
    ],
    defaultCron: '0 9 * * 1-5', // 9 AM weekdays
  },

  output_count: {
    name: 'Output Count',
    questions: [
      { id: uuid(), text: 'How many items did you complete today?', type: 'number', required: true },
      { id: uuid(), text: 'Any blockers?', type: 'boolean', required: true },
      { id: uuid(), text: 'If blocked, describe the issue:', type: 'text', required: false },
    ],
    defaultCron: '0 17 * * 1-5', // 5 PM weekdays
  },

  weekly_forecast: {
    name: 'Weekly Forecast',
    questions: [
      { id: uuid(), text: 'Key accomplishments this week:', type: 'text', required: true },
      { id: uuid(), text: 'Goals for next week:', type: 'text', required: true },
      { id: uuid(), text: 'Expected deliverable count:', type: 'number', required: false },
      { id: uuid(), text: 'Risks or concerns:', type: 'text', required: false },
    ],
    defaultCron: '0 16 * * 5', // 4 PM Friday
  },
} as const;
```

### Escalation Message Formatting
```typescript
// src/features/escalations/escalations.messages.ts

export function formatEscalationMessage(
  blocker: Blocker,
  stepIndex: number,
  reporter: { email: string }
): string {
  const urgency = stepIndex === 0 ? '' : ` (Escalation level ${stepIndex + 1})`;

  return `Blocker Alert${urgency}

${reporter.email.split('@')[0]} reported a blocker:

"${blocker.title}"

${blocker.description ? `Details: ${blocker.description}\n\n` : ''}
Reported: ${dayjs(blocker.createdAt).fromNow()}

Reply with "resolve ${blocker.id.slice(0, 8)}" to mark as resolved.`;
}

export function formatDeadlineRiskAlert(
  item: Deliverable,
  daysUntilDue: number
): string {
  return `Deadline Risk Alert

"${item.title}" is due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''} but hasn't progressed.

Due: ${dayjs(item.dueDate).format('MMM D, YYYY')}
Current status: ${item.status}

Please check on this deliverable or update its status.`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed notification times | Per-user timezone scheduling | 2024+ | Better UX for distributed teams |
| Manual escalation emails | Automated time-windowed chains | 2023+ | Faster issue resolution |
| Generic status reports | Role-tailored LLM recaps | 2024+ | More relevant insights |
| Polling for deadline risk | Event-driven + periodic checks | 2023+ | Lower resource usage |
| Static escalation targets | Dynamic chain following reportsTo | 2024+ | Org structure changes auto-reflected |

**Deprecated/outdated:**
- **Fixed UTC scheduling:** Use timezone-aware scheduling for global teams
- **Email-only escalations:** Multi-channel delivery (chat + email) preferred
- **Manual check-in responses:** Bot-parsed structured responses

## Open Questions

1. **User Timezone Storage**
   - What we know: Need per-user timezone for check-in scheduling
   - What's unclear: Where to store (user_messaging? new user_preferences table?)
   - Recommendation: Add `timezone` column to user_messaging table, default to organization timezone

2. **Check-in Response Matching**
   - What we know: Need to match user replies to check-in prompts
   - What's unclear: Best approach for matching natural language responses to specific questions
   - Recommendation: Use conversation context + LLM to parse structured responses from replies

3. **Output Threshold Definition**
   - What we know: Need configurable "low output" thresholds
   - What's unclear: How to define "output" (tasks? deliverables? both? weighted?)
   - Recommendation: Start with completed deliverables count per period, add task weighting later

4. **Escalation De-escalation**
   - What we know: Resolved blockers cancel future escalations
   - What's unclear: Should there be automatic de-escalation notifications?
   - Recommendation: Yes, notify escalated parties when blocker is resolved

## Sources

### Primary (HIGH confidence)
- [BullMQ Repeatable Jobs Documentation](https://docs.bullmq.io/guide/jobs/repeatable) - Cron patterns, timezone support
- [BullMQ Repeat Options](https://docs.bullmq.io/guide/job-schedulers/repeat-options) - Scheduling configuration
- [Drizzle ORM Documentation](https://orm.drizzle.team) - JSONB typing, query patterns
- Existing codebase patterns in `/src/features/messaging/` and `/src/features/notifications/`

### Secondary (MEDIUM confidence)
- [OneUptime - Incident Escalation Paths](https://oneuptime.com/blog/post/2026-01-28-incident-escalation-paths/view) - Escalation chain patterns
- [LeanWisdom - Escalation Matrix Guide](https://www.leanwisdom.com/blog/escalation-matrix-meaning-format-strategy/) - Time-based routing best practices
- [Geekbot - Standup Bot Patterns](https://geekbot.com/blog/slack-standup-bot/) - Check-in question formats
- [DailyBot Check-ins](https://www.dailybot.com/) - Async check-in patterns

### Tertiary (LOW confidence)
- General escalation management patterns from search results
- Blocker reporting workflows from agile resources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, verified API capabilities
- Check-in architecture: HIGH - Builds directly on existing proactive messaging
- Escalation chains: MEDIUM-HIGH - BullMQ delayed jobs verified, chain pattern is standard
- Recap generation: MEDIUM - LLM approach solid, role-based tailoring needs iteration
- Blocker intent detection: MEDIUM - Extension of existing NLU, entity extraction may need tuning

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - patterns are stable, BullMQ API stable)

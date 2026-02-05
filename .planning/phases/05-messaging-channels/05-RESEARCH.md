# Phase 5: Messaging Channels - Research

**Researched:** 2026-02-06
**Domain:** Telegram/WhatsApp bot integration, NLU intent recognition, proactive messaging, activity notifications
**Confidence:** MEDIUM-HIGH

## Summary

This phase implements messaging channel integrations (Telegram and WhatsApp) that allow users to interact with the BlockBot agent via chat. The implementation requires: (1) webhook-based bot frameworks for both platforms, (2) LLM-based intent recognition using the existing LiteLLM infrastructure, (3) per-user session management with project context switching, (4) proactive messaging via scheduled jobs, and (5) an activity/notification system for @mentions and comments.

The standard approach in 2026 uses grammY for Telegram (TypeScript-native, middleware-based, supports Bun) and direct WhatsApp Cloud API integration via @great-detail/whatsapp SDK (the official Meta SDK is archived). Intent recognition leverages the existing LLM infrastructure with OpenAI function calling/structured outputs rather than traditional NLP classifiers. User session state (current project, conversation history reference) is stored in Redis with per-user keys, integrated with the existing ioredis connection used by BullMQ.

Key findings indicate that both platforms use webhook-based architectures where messages arrive as HTTP POST requests to your server. grammY has built-in session middleware with Redis adapter support. WhatsApp requires 24-hour session windows and template messages for proactive outreach. Proactive messaging (check-ins, alerts, recaps) should use BullMQ scheduled jobs that queue messages to both platforms.

**Primary recommendation:** Use grammY for Telegram with @grammyjs/storage-redis for sessions, @great-detail/whatsapp for WhatsApp Cloud API, LLM function calling for intent detection, and BullMQ for proactive message scheduling.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | 1.x (latest) | Telegram bot framework | TypeScript-native, middleware pattern, Bun support, active maintenance |
| @grammyjs/storage-redis | 2.5.x | Session persistence | Official adapter, uses ioredis (matches existing queue connection) |
| @grammyjs/conversations | 2.x | Multi-step dialog flows | Replay-based execution, form builders, menu support |
| @great-detail/whatsapp | 8.x | WhatsApp Cloud API | TypeScript support, Bun compatible, actively maintained (official SDK archived) |
| ioredis | 5.x | Redis client for sessions | Already in use for BullMQ, reuse connection pool |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| BullMQ | 5.x | Proactive message scheduling | Scheduled check-ins, alerts, recaps (already in use) |
| zod | 3.x | Intent schema validation | Function calling response validation (already in use) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| grammY | Telegraf | Telegraf is popular but grammY has better TypeScript, more active development |
| grammY | node-telegram-bot-api | Lower-level, requires more boilerplate, less middleware support |
| @great-detail/whatsapp | whatsapp-business-sdk | Both work; @great-detail has Bun support and cleaner TypeScript |
| LLM function calling | node-nlp | node-nlp requires training data; function calling works zero-shot with existing LLM |

**Installation:**
```bash
bun add grammy @grammyjs/storage-redis @grammyjs/conversations @great-detail/whatsapp
```

## Architecture Patterns

### Recommended Project Structure
```
src/features/
├── messaging/                    # Unified messaging interface
│   ├── __tests__/
│   ├── messaging.types.ts        # Shared types for both platforms
│   ├── messaging.service.ts      # Platform-agnostic message handling
│   ├── messaging.intents.ts      # Intent detection via LLM
│   └── messaging.context.ts      # User context/session management
├── telegram/                     # Telegram-specific
│   ├── __tests__/
│   ├── telegram.bot.ts           # grammY bot setup
│   ├── telegram.handlers.ts      # Command and message handlers
│   ├── telegram.webhooks.ts      # Webhook route for Hono
│   └── telegram.types.ts         # Telegram-specific types
├── whatsapp/                     # WhatsApp-specific
│   ├── __tests__/
│   ├── whatsapp.client.ts        # WhatsApp SDK client
│   ├── whatsapp.handlers.ts      # Message handlers
│   ├── whatsapp.webhooks.ts      # Webhook route for Hono
│   └── whatsapp.types.ts         # WhatsApp-specific types
├── notifications/                # Activity notifications
│   ├── __tests__/
│   ├── notifications.service.ts  # Notification CRUD
│   ├── notifications.worker.ts   # Delivery worker
│   └── notifications.types.ts    # Notification types
└── comments/                     # Task/deliverable comments
    ├── __tests__/
    ├── comments.service.ts       # Comment CRUD with @mention parsing
    ├── comments.routes.ts        # Comment API endpoints
    └── comments.types.ts         # Comment types

src/shared/
└── db/schema/
    ├── comments.ts               # Comments table
    ├── notifications.ts          # Notifications table
    ├── user-messaging.ts         # User messaging preferences/connections
    └── user-contexts.ts          # Per-user project context tracking
```

### Pattern 1: Unified Messaging Interface
**What:** Abstract platform differences behind a common interface
**When to use:** Any code that sends messages to users
**Example:**
```typescript
// src/features/messaging/messaging.types.ts
export interface MessagingUser {
  userId: string;           // Internal user ID
  platform: 'telegram' | 'whatsapp';
  platformUserId: string;   // Telegram chat ID or WhatsApp phone
}

export interface OutgoingMessage {
  text: string;
  buttons?: Array<{ text: string; callback: string }>;
  parseMode?: 'Markdown' | 'HTML';
}

export interface MessageContext {
  user: MessagingUser;
  organizationId: string;
  projectId: string | null;  // Current project context
  conversationId: string;    // Conversation record ID
  visibleProjectIds: string[];
}

// src/features/messaging/messaging.service.ts
import { sendTelegramMessage } from '../telegram/telegram.handlers';
import { sendWhatsAppMessage } from '../whatsapp/whatsapp.handlers';

export async function sendMessage(
  user: MessagingUser,
  message: OutgoingMessage
): Promise<void> {
  switch (user.platform) {
    case 'telegram':
      await sendTelegramMessage(user.platformUserId, message);
      break;
    case 'whatsapp':
      await sendWhatsAppMessage(user.platformUserId, message);
      break;
  }
}
```

### Pattern 2: grammY Bot with Redis Sessions
**What:** Telegram bot with persistent per-user sessions stored in Redis
**When to use:** All Telegram interactions
**Example:**
```typescript
// src/features/telegram/telegram.bot.ts
import { Bot, session, type Context, type SessionFlavor } from 'grammy';
import { RedisAdapter } from '@grammyjs/storage-redis';
import { getQueueConnection } from '../../shared/lib/queue/client';
import { env } from '../../shared/lib/env';

interface SessionData {
  currentProjectId: string | null;
  conversationId: string | null;
  lastActivity: number;
}

type BotContext = Context & SessionFlavor<SessionData>;

export function createTelegramBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

  // Use same ioredis connection as BullMQ
  const storage = new RedisAdapter<SessionData>({
    instance: getQueueConnection(),
  });

  bot.use(session({
    initial: (): SessionData => ({
      currentProjectId: null,
      conversationId: null,
      lastActivity: Date.now(),
    }),
    storage,
    getSessionKey: (ctx) => ctx.from?.id.toString(),
  }));

  return bot;
}
```

### Pattern 3: LLM-Based Intent Detection
**What:** Use function calling to classify user intent without training data
**When to use:** Processing natural language messages
**Example:**
```typescript
// src/features/messaging/messaging.intents.ts
import { createLLMClient } from '../llm';
import { z } from 'zod';

const IntentSchema = z.object({
  intent: z.enum([
    'query_tasks',        // "what's due this week?"
    'query_status',       // "squad status", "project progress"
    'create_task',        // "create task X"
    'update_task',        // "mark task X as done"
    'switch_project',     // "/switch" or "switch to project X"
    'help',               // "help", "what can you do?"
    'unknown'
  ]),
  entities: z.object({
    projectName: z.string().optional(),
    taskTitle: z.string().optional(),
    timeRange: z.enum(['today', 'this_week', 'this_month']).optional(),
    status: z.enum(['todo', 'in_progress', 'done']).optional(),
  }),
  confidence: z.number().min(0).max(1),
});

export type Intent = z.infer<typeof IntentSchema>;

const INTENT_FUNCTIONS = [{
  name: 'classify_intent',
  description: 'Classify the user message intent for a project management assistant',
  parameters: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['query_tasks', 'query_status', 'create_task', 'update_task', 'switch_project', 'help', 'unknown'],
        description: 'The classified intent'
      },
      entities: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project name if mentioned' },
          taskTitle: { type: 'string', description: 'Task title if mentioned' },
          timeRange: { type: 'string', enum: ['today', 'this_week', 'this_month'] },
          status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
        }
      },
      confidence: { type: 'number', description: '0-1 confidence score' }
    },
    required: ['intent', 'entities', 'confidence']
  }
}];

export async function detectIntent(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<Intent> {
  const client = createLLMClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a project management assistant. Classify user messages into intents.'
      },
      ...conversationHistory.slice(-5).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user', content: message }
    ],
    tools: [{
      type: 'function',
      function: INTENT_FUNCTIONS[0]
    }],
    tool_choice: { type: 'function', function: { name: 'classify_intent' } }
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    return { intent: 'unknown', entities: {}, confidence: 0 };
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  return IntentSchema.parse(parsed);
}
```

### Pattern 4: User Context Management
**What:** Track and switch project contexts per user
**When to use:** Processing messages and /switch command
**Example:**
```typescript
// src/features/messaging/messaging.context.ts
import { db, schema } from '../../shared/db';
import { eq, and } from 'drizzle-orm';
import { getVisibleProjectIds } from '../visibility';

export interface UserContext {
  organizationId: string;
  currentProjectId: string | null;
  visibleProjectIds: string[];
}

/**
 * Gets or creates user messaging context.
 * Loads the user's last-used project if available.
 */
export async function getUserContext(userId: string): Promise<UserContext> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get user's messaging preferences (includes last project)
  const userMessaging = await db.query.userMessaging.findFirst({
    where: eq(schema.userMessaging.userId, userId),
  });

  // Get visible projects for this user
  const visibleProjectIds = await getVisibleProjectIds(userId, user.orgId);

  // Validate last project is still visible
  let currentProjectId = userMessaging?.lastProjectId ?? null;
  if (currentProjectId && !visibleProjectIds.includes(currentProjectId)) {
    currentProjectId = null;
  }

  return {
    organizationId: user.orgId,
    currentProjectId,
    visibleProjectIds,
  };
}

/**
 * Switches user's current project context.
 */
export async function switchProject(
  userId: string,
  projectId: string
): Promise<void> {
  const context = await getUserContext(userId);

  if (!context.visibleProjectIds.includes(projectId)) {
    throw new Error('Project not visible to user');
  }

  await db
    .insert(schema.userMessaging)
    .values({
      userId,
      lastProjectId: projectId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.userMessaging.userId,
      set: {
        lastProjectId: projectId,
        updatedAt: new Date(),
      },
    });
}
```

### Pattern 5: WhatsApp Webhook Integration with Hono
**What:** Handle WhatsApp Cloud API webhooks
**When to use:** Receiving and sending WhatsApp messages
**Example:**
```typescript
// src/features/whatsapp/whatsapp.webhooks.ts
import { Hono } from 'hono';
import Client from '@great-detail/whatsapp';
import { env } from '../../shared/lib/env';
import { processIncomingMessage } from '../messaging/messaging.service';

const app = new Hono();

const whatsapp = new Client({
  request: {
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
  },
});

// Webhook verification (GET)
app.get('/webhook/whatsapp', async (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    return c.text(challenge ?? '');
  }

  return c.text('Forbidden', 403);
});

// Webhook events (POST)
app.post('/webhook/whatsapp', async (c) => {
  const body = await c.req.text();
  const signature = c.req.header('x-hub-signature-256');

  // Verify signature
  const event = whatsapp.webhook.eventNotification({
    method: 'POST',
    query: {},
    body,
    headers: Object.fromEntries(c.req.raw.headers),
  });

  try {
    event.verifySignature(env.WHATSAPP_APP_SECRET);
  } catch {
    return c.text('Invalid signature', 401);
  }

  // Process messages
  const payload = JSON.parse(body);
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === 'messages') {
        for (const message of change.value.messages ?? []) {
          await processIncomingMessage({
            platform: 'whatsapp',
            platformUserId: message.from,
            messageId: message.id,
            text: message.text?.body ?? '',
            timestamp: new Date(Number(message.timestamp) * 1000),
          });
        }
      }
    }
  }

  return c.text('OK');
});

export default app;

// src/features/whatsapp/whatsapp.handlers.ts
import Client from '@great-detail/whatsapp';
import { env } from '../../shared/lib/env';
import type { OutgoingMessage } from '../messaging/messaging.types';

const whatsapp = new Client({
  request: {
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
  },
});

export async function sendWhatsAppMessage(
  to: string,
  message: OutgoingMessage
): Promise<void> {
  await whatsapp.message.createMessage({
    phoneNumberID: env.WHATSAPP_PHONE_NUMBER_ID,
    to,
    type: 'text',
    text: { body: message.text },
  });
}
```

### Pattern 6: Proactive Message Scheduling
**What:** Schedule check-ins, alerts, and recaps via BullMQ
**When to use:** Proactive outreach (MSG-06)
**Example:**
```typescript
// src/features/messaging/messaging.worker.ts
import { Worker, Queue } from 'bullmq';
import { getQueueConnection } from '../../shared/lib/queue/client';
import { sendMessage } from './messaging.service';
import { getOverdueTasks, getUpcomingTasks } from '../tasks';
import { getDailyRecap } from '../metrics';

export const proactiveMessagingQueue = new Queue('proactive-messaging', {
  connection: getQueueConnection(),
});

interface ProactiveJobData {
  type: 'daily_checkin' | 'overdue_alert' | 'weekly_recap';
  userId: string;
  platform: 'telegram' | 'whatsapp';
  platformUserId: string;
  projectId?: string;
}

export const proactiveMessagingWorker = new Worker<ProactiveJobData>(
  'proactive-messaging',
  async (job) => {
    const { type, userId, platform, platformUserId, projectId } = job.data;

    let message: string;

    switch (type) {
      case 'daily_checkin': {
        const tasks = await getUpcomingTasks(userId, projectId, 'today');
        if (tasks.length === 0) {
          message = "Good morning! You have no tasks due today. Enjoy your day!";
        } else {
          message = `Good morning! You have ${tasks.length} task${tasks.length > 1 ? 's' : ''} due today:\n\n`;
          message += tasks.slice(0, 5).map(t => `- ${t.title}`).join('\n');
          if (tasks.length > 5) {
            message += `\n\n...and ${tasks.length - 5} more.`;
          }
        }
        break;
      }

      case 'overdue_alert': {
        const overdue = await getOverdueTasks(userId, projectId);
        if (overdue.length === 0) return;

        message = `You have ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}:\n\n`;
        message += overdue.slice(0, 5).map(t => `- ${t.title}`).join('\n');
        break;
      }

      case 'weekly_recap': {
        const recap = await getDailyRecap(userId, projectId);
        message = `Weekly Recap:\n\n`;
        message += `- Tasks completed: ${recap.completedTasks}\n`;
        message += `- Tasks in progress: ${recap.inProgressTasks}\n`;
        message += `- Tasks created: ${recap.createdTasks}\n`;
        break;
      }

      default:
        return;
    }

    await sendMessage(
      { userId, platform, platformUserId },
      { text: message }
    );
  },
  { connection: getQueueConnection() }
);

// Schedule daily check-ins (cron: 9 AM user's timezone)
export async function scheduleDailyCheckin(
  userId: string,
  platform: 'telegram' | 'whatsapp',
  platformUserId: string
): Promise<void> {
  await proactiveMessagingQueue.add(
    'daily-checkin',
    { type: 'daily_checkin', userId, platform, platformUserId },
    {
      repeat: { pattern: '0 9 * * *' }, // 9 AM daily
      jobId: `daily-checkin-${userId}`,
    }
  );
}
```

### Pattern 7: Comments with @Mention Parsing
**What:** Parse @mentions from comment text and create notifications
**When to use:** Comment creation (COMM-01, COMM-02)
**Example:**
```typescript
// src/features/comments/comments.service.ts
import { db, schema } from '../../shared/db';
import { eq } from 'drizzle-orm';
import { notificationQueue } from '../notifications/notifications.worker';

// Regex to match @mentions (handles @username or @email format)
const MENTION_REGEX = /@([a-zA-Z0-9._+-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)/g;

interface CreateCommentInput {
  targetType: 'task' | 'deliverable';
  targetId: string;
  content: string;
  authorId: string;
  projectId: string;
}

export async function createComment(input: CreateCommentInput) {
  // Parse @mentions from content
  const mentions = parseMentions(input.content);

  // Create comment
  const [comment] = await db
    .insert(schema.comments)
    .values({
      targetType: input.targetType,
      targetId: input.targetId,
      content: input.content,
      authorId: input.authorId,
      projectId: input.projectId,
      mentions: mentions.map(m => m.userId),
    })
    .returning();

  // Resolve mentioned users and queue notifications
  for (const mention of mentions) {
    if (mention.userId !== input.authorId) {
      await notificationQueue.add('mention', {
        type: 'mention',
        userId: mention.userId,
        actorId: input.authorId,
        targetType: input.targetType,
        targetId: input.targetId,
        commentId: comment.id,
        projectId: input.projectId,
      });
    }
  }

  // Notify task/deliverable assignee if not author
  const target = input.targetType === 'task'
    ? await db.query.tasks.findFirst({ where: eq(schema.tasks.id, input.targetId) })
    : await db.query.deliverables.findFirst({ where: eq(schema.deliverables.id, input.targetId) });

  if (target?.assigneeId && target.assigneeId !== input.authorId) {
    await notificationQueue.add('comment', {
      type: 'comment',
      userId: target.assigneeId,
      actorId: input.authorId,
      targetType: input.targetType,
      targetId: input.targetId,
      commentId: comment.id,
      projectId: input.projectId,
    });
  }

  return comment;
}

function parseMentions(content: string): Array<{ raw: string; userId: string | null }> {
  const matches = content.matchAll(MENTION_REGEX);
  const mentions: Array<{ raw: string; userId: string | null }> = [];

  for (const match of matches) {
    mentions.push({
      raw: match[0],
      userId: null, // Will be resolved by looking up user by email
    });
  }

  return mentions;
}

export async function resolveMentions(
  mentions: Array<{ raw: string }>,
  organizationId: string
): Promise<Array<{ raw: string; userId: string }>> {
  const resolved: Array<{ raw: string; userId: string }> = [];

  for (const mention of mentions) {
    const identifier = mention.raw.slice(1); // Remove @

    // Try to find user by email (or partial email match within org)
    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.orgId, organizationId),
        eq(schema.users.email, identifier)
      ),
    });

    if (user) {
      resolved.push({ raw: mention.raw, userId: user.id });
    }
  }

  return resolved;
}
```

### Pattern 8: Notification Delivery Worker
**What:** Process notification queue and deliver to messaging channels
**When to use:** All notification types (COMM-03)
**Example:**
```typescript
// src/features/notifications/notifications.worker.ts
import { Worker, Queue } from 'bullmq';
import { getQueueConnection } from '../../shared/lib/queue/client';
import { db, schema } from '../../shared/db';
import { eq } from 'drizzle-orm';
import { sendMessage } from '../messaging/messaging.service';

export const notificationQueue = new Queue('notifications', {
  connection: getQueueConnection(),
});

interface NotificationJobData {
  type: 'mention' | 'comment' | 'assignment' | 'status_change' | 'due_soon';
  userId: string;
  actorId: string;
  targetType: 'task' | 'deliverable';
  targetId: string;
  projectId: string;
  commentId?: string;
  extra?: Record<string, unknown>;
}

export const notificationWorker = new Worker<NotificationJobData>(
  'notifications',
  async (job) => {
    const { type, userId, actorId, targetType, targetId, projectId, commentId } = job.data;

    // Store notification in database
    const [notification] = await db
      .insert(schema.notifications)
      .values({
        userId,
        type,
        actorId,
        targetType,
        targetId,
        projectId,
        commentId,
        read: false,
      })
      .returning();

    // Get user's messaging preferences
    const userMessaging = await db.query.userMessaging.findFirst({
      where: eq(schema.userMessaging.userId, userId),
    });

    if (!userMessaging?.messagingEnabled) return;

    // Get actor name for message
    const actor = await db.query.users.findFirst({
      where: eq(schema.users.id, actorId),
    });

    // Get target title
    const target = targetType === 'task'
      ? await db.query.tasks.findFirst({ where: eq(schema.tasks.id, targetId) })
      : await db.query.deliverables.findFirst({ where: eq(schema.deliverables.id, targetId) });

    // Build notification message
    const actorName = actor?.email.split('@')[0] ?? 'Someone';
    const targetTitle = target?.title ?? 'an item';

    let message: string;
    switch (type) {
      case 'mention':
        message = `${actorName} mentioned you in a comment on "${targetTitle}"`;
        break;
      case 'comment':
        message = `${actorName} commented on "${targetTitle}"`;
        break;
      case 'assignment':
        message = `${actorName} assigned you to "${targetTitle}"`;
        break;
      case 'status_change':
        message = `${actorName} updated the status of "${targetTitle}"`;
        break;
      case 'due_soon':
        message = `"${targetTitle}" is due soon`;
        break;
      default:
        message = `You have a new notification`;
    }

    // Send to user's preferred channel
    if (userMessaging.telegramChatId) {
      await sendMessage(
        { userId, platform: 'telegram', platformUserId: userMessaging.telegramChatId },
        { text: message }
      );
    }

    if (userMessaging.whatsappPhone) {
      await sendMessage(
        { userId, platform: 'whatsapp', platformUserId: userMessaging.whatsappPhone },
        { text: message }
      );
    }
  },
  { connection: getQueueConnection() }
);
```

### Anti-Patterns to Avoid
- **Polling for Telegram updates:** Use webhooks in production; polling wastes resources and adds latency
- **Storing full conversation in session:** Session should only store context IDs; use database for conversation history
- **Blocking on LLM calls in message handlers:** Use async processing; respond quickly to webhooks
- **Single LLM call for response + intent:** Separate intent detection from response generation for better control
- **Hardcoded message templates:** Use configuration or database for message templates (localization, A/B testing)
- **Ignoring WhatsApp 24-hour window:** Proactive messages outside window require pre-approved templates

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Telegram bot framework | Raw HTTP/webhook parsing | grammY | Middleware, sessions, conversations, updates handled correctly |
| Session storage | Custom Redis logic | @grammyjs/storage-redis | TTL, serialization, key management built-in |
| WhatsApp webhook verification | Manual signature check | @great-detail/whatsapp | Signature verification, event parsing included |
| Intent classification | Custom NLP model | LLM function calling | Zero-shot, no training data, works with existing LiteLLM |
| Job scheduling | setInterval/cron | BullMQ repeatable jobs | Persistence, retries, distribution (already in use) |
| @mention parsing | Basic regex only | Regex + DB lookup | Need to resolve mentions to user IDs |

**Key insight:** Bot frameworks like grammY handle many edge cases (update types, error recovery, rate limiting) that are easy to get wrong with raw API calls. The existing LLM infrastructure makes intent detection trivial compared to training classifiers.

## Common Pitfalls

### Pitfall 1: WhatsApp Session Window Expiration
**What goes wrong:** Proactive messages fail with "message undeliverable"
**Why it happens:** WhatsApp requires user-initiated conversation within 24 hours for free-form messages
**How to avoid:** Use message templates for proactive outreach; track session windows per user
**Warning signs:** Failed message delivery after 24+ hours of inactivity

### Pitfall 2: Telegram Webhook Not Receiving Updates
**What goes wrong:** Bot doesn't respond to messages
**Why it happens:** Webhook URL not properly registered, SSL certificate issues, or webhook returning non-200
**How to avoid:** Use grammY's `bot.api.setWebhook()` with valid HTTPS URL; return 200 quickly
**Warning signs:** No webhook calls in server logs, Telegram getWebhookInfo shows pending_update_count growing

### Pitfall 3: Session Data Loss on Bot Restart
**What goes wrong:** User's project context resets
**Why it happens:** Using in-memory session storage in production
**How to avoid:** Always use Redis adapter for sessions; test session persistence across restarts
**Warning signs:** Users complain context resets after deployments

### Pitfall 4: Intent Detection Hallucination
**What goes wrong:** LLM returns incorrect intent or invents entities
**Why it happens:** Ambiguous messages, missing context, or weak prompt
**How to avoid:** Include conversation history in intent detection; use confidence thresholds; fallback to clarification
**Warning signs:** Bot takes wrong actions, users report "it didn't understand me"

### Pitfall 5: Notification Spam
**What goes wrong:** Users receive too many notifications
**Why it happens:** No deduplication, no batching, no quiet hours
**How to avoid:** Batch similar notifications; respect user preferences; implement quiet hours
**Warning signs:** Users disable notifications, high unsubscribe rate

### Pitfall 6: Race Conditions in Context Switching
**What goes wrong:** Message processed with wrong project context
**Why it happens:** /switch command and subsequent message processed out of order
**How to avoid:** Use Redis transactions or optimistic locking for context updates
**Warning signs:** Responses reference wrong project after switching

## Code Examples

### Database Schema: User Messaging Preferences
```typescript
// src/shared/db/schema/user-messaging.ts
import { boolean, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userMessaging = pgTable('user_messaging', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Telegram connection
  telegramChatId: varchar('telegram_chat_id', { length: 100 }),
  telegramUsername: varchar('telegram_username', { length: 100 }),
  telegramVerified: boolean('telegram_verified').default(false).notNull(),

  // WhatsApp connection
  whatsappPhone: varchar('whatsapp_phone', { length: 20 }),
  whatsappVerified: boolean('whatsapp_verified').default(false).notNull(),

  // Preferences
  messagingEnabled: boolean('messaging_enabled').default(true).notNull(),
  dailyCheckinEnabled: boolean('daily_checkin_enabled').default(false).notNull(),
  weeklyRecapEnabled: boolean('weekly_recap_enabled').default(false).notNull(),

  // Context
  lastProjectId: uuid('last_project_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Database Schema: Comments
```typescript
// src/shared/db/schema/comments.ts
import { jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // Polymorphic target
  targetType: varchar('target_type', { length: 20 }).notNull(), // 'task' | 'deliverable'
  targetId: uuid('target_id').notNull(),

  // Content
  content: text('content').notNull(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Resolved @mentions (user IDs)
  mentions: jsonb('mentions').$type<string[]>().default([]),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Database Schema: Notifications
```typescript
// src/shared/db/schema/notifications.ts
import { boolean, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';
import { comments } from './comments';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  type: varchar('type', { length: 50 }).notNull(), // 'mention' | 'comment' | 'assignment' | 'status_change' | 'due_soon'

  // Actor who triggered notification
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),

  // Target item
  targetType: varchar('target_type', { length: 20 }).notNull(), // 'task' | 'deliverable'
  targetId: uuid('target_id').notNull(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // Related comment (for mention/comment notifications)
  commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'cascade' }),

  // State
  read: boolean('read').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Telegram Command Handlers
```typescript
// src/features/telegram/telegram.handlers.ts
import type { BotContext } from './telegram.bot';
import { detectIntent } from '../messaging/messaging.intents';
import { getUserContext, switchProject } from '../messaging/messaging.context';
import { sendMessage as conversationSendMessage } from '../conversations';
import { listUserProjects } from '../projects';

export function registerHandlers(bot: Bot<BotContext>) {
  // /start - Connect account
  bot.command('start', async (ctx) => {
    const deepLinkParam = ctx.match; // e.g., "connect_abc123"

    if (deepLinkParam?.startsWith('connect_')) {
      const token = deepLinkParam.replace('connect_', '');
      const result = await connectTelegramAccount(ctx.from.id, token);

      if (result.success) {
        await ctx.reply(`Connected! Your account is now linked.\n\nUse /switch to select a project.`);
      } else {
        await ctx.reply(`Connection failed: ${result.error}`);
      }
      return;
    }

    await ctx.reply(
      `Welcome to BlockBot!\n\n` +
      `To connect your account, go to the web app and click "Connect Telegram".\n\n` +
      `Commands:\n` +
      `/switch - Change project context\n` +
      `/status - View current project status\n` +
      `/help - Show all commands`
    );
  });

  // /switch - Select project
  bot.command('switch', async (ctx) => {
    const userId = await getUserIdFromTelegram(ctx.from.id);
    if (!userId) {
      await ctx.reply('Please connect your account first using the web app.');
      return;
    }

    const projects = await listUserProjects(userId);

    if (projects.length === 0) {
      await ctx.reply('You have no projects yet.');
      return;
    }

    const keyboard = projects.map(p => [{
      text: p.name,
      callback_data: `switch:${p.id}`
    }]);

    await ctx.reply('Select a project:', {
      reply_markup: { inline_keyboard: keyboard }
    });
  });

  // Handle project switch callback
  bot.callbackQuery(/^switch:(.+)$/, async (ctx) => {
    const projectId = ctx.match[1];
    const userId = await getUserIdFromTelegram(ctx.from.id);

    await switchProject(userId, projectId);
    ctx.session.currentProjectId = projectId;

    const project = await getProject(projectId);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`Switched to project: ${project.name}`);
  });

  // Natural language messages
  bot.on('message:text', async (ctx) => {
    const userId = await getUserIdFromTelegram(ctx.from.id);
    if (!userId) {
      await ctx.reply('Please connect your account first using the web app.');
      return;
    }

    const userContext = await getUserContext(userId);

    // Detect intent
    const intent = await detectIntent(ctx.message.text, []);

    // Handle based on intent
    switch (intent.intent) {
      case 'switch_project':
        await ctx.reply('Use /switch to change projects.');
        break;

      case 'query_tasks':
      case 'query_status':
      case 'create_task':
      case 'update_task':
        // Use conversation service for complex queries
        const response = await conversationSendMessage(
          ctx.session.conversationId!,
          ctx.message.text,
          userContext.organizationId,
          userId,
          userContext.visibleProjectIds,
          userContext.currentProjectId ?? undefined
        );
        await ctx.reply(response.message.content);
        break;

      default:
        await ctx.reply(
          "I'm not sure what you're asking. Try:\n" +
          "- 'What's due this week?'\n" +
          "- 'Squad status'\n" +
          "- 'Create task: Review proposal'"
        );
    }
  });
}
```

### Activity Feed Query
```typescript
// src/features/notifications/notifications.service.ts
import { desc, eq, and, sql } from 'drizzle-orm';
import { db, schema } from '../../shared/db';

interface ActivityFeedItem {
  id: string;
  type: string;
  actorId: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
  targetTitle: string;
  projectId: string;
  projectName: string;
  createdAt: Date;
}

export async function getActivityFeed(
  projectId: string,
  limit = 50,
  offset = 0
): Promise<ActivityFeedItem[]> {
  // Union of recent actions across different tables
  const result = await db.execute(sql`
    SELECT
      n.id,
      n.type,
      n.actor_id,
      u.email as actor_email,
      n.target_type,
      n.target_id,
      COALESCE(t.title, d.title) as target_title,
      n.project_id,
      p.name as project_name,
      n.created_at
    FROM notifications n
    LEFT JOIN users u ON n.actor_id = u.id
    LEFT JOIN tasks t ON n.target_type = 'task' AND n.target_id = t.id
    LEFT JOIN deliverables d ON n.target_type = 'deliverable' AND n.target_id = d.id
    LEFT JOIN projects p ON n.project_id = p.id
    WHERE n.project_id = ${projectId}
    ORDER BY n.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  return result.rows as ActivityFeedItem[];
}

export async function getUserNotifications(
  userId: string,
  unreadOnly = false,
  limit = 50
) {
  const conditions = [eq(schema.notifications.userId, userId)];

  if (unreadOnly) {
    conditions.push(eq(schema.notifications.read, false));
  }

  return db.query.notifications.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.notifications.createdAt)],
    limit,
  });
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await db
    .update(schema.notifications)
    .set({ read: true })
    .where(and(
      eq(schema.notifications.id, notificationId),
      eq(schema.notifications.userId, userId)
    ));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Train NLP classifier for intents | LLM function calling | 2024-2025 | Zero training data, better accuracy |
| Custom bot API wrappers | Framework (grammY, Telegraf) | 2020+ | Middleware, sessions, error handling |
| Official WhatsApp SDK | Community SDKs | 2024 (SDK archived) | Use @great-detail/whatsapp |
| Polling for Telegram updates | Webhooks | 2016+ | Lower latency, no wasted requests |
| Build conversation flows manually | Conversation plugins | 2023+ | Replay-based state management |

**Deprecated/outdated:**
- **Official WhatsApp Node.js SDK:** Archived by Meta; use community alternatives
- **Long polling for Telegram:** Only for development; production should use webhooks
- **Dedicated NLP services (Wit.ai, Dialogflow):** LLM function calling is simpler for intent detection
- **Manual session serialization:** Use framework adapters (grammY storage-redis)

## Open Questions

1. **WhatsApp Business Verification**
   - What we know: Requires Meta Business verification, 24-hour session windows, template approval
   - What's unclear: Timeline for verification, specific template requirements for this use case
   - Recommendation: Start with Telegram-only; add WhatsApp after verification is confirmed

2. **Telegram Account Linking Flow**
   - What we know: Need to link Telegram chat ID to internal user ID
   - What's unclear: Best UX for account connection (deep links vs verification codes)
   - Recommendation: Use deep links with temporary tokens generated from web app

3. **Multi-language Support**
   - What we know: grammY has i18n plugin; LLM can respond in user's language
   - What's unclear: How to detect/store user language preference
   - Recommendation: Start with English; add language detection later

4. **Rate Limiting for Proactive Messages**
   - What we know: WhatsApp and Telegram have rate limits
   - What's unclear: Exact limits for business accounts
   - Recommendation: Implement per-user rate limiting; start conservative (max 5 proactive/day)

## Sources

### Primary (HIGH confidence)
- [grammY Documentation](https://grammy.dev/guide/getting-started) - Bot setup, middleware, sessions
- [grammY Sessions Plugin](https://grammy.dev/plugins/session) - Redis storage, multi-sessions
- [grammY Conversations Plugin](https://grammy.dev/plugins/conversations) - Multi-step dialogs
- [@grammyjs/storage-redis](https://github.com/grammyjs/storages) - Redis adapter
- [@great-detail/whatsapp SDK](https://github.com/great-detail/WhatsApp-JS-SDK) - WhatsApp Cloud API
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling) - Intent detection

### Secondary (MEDIUM confidence)
- [WhatsApp Cloud API Integration Guide](https://www.connverz.com/blog/whatsapp-cloud-api-integration-guide-for-developers-in-2026) - Webhook setup
- [Redis Session Management](https://redis.io/docs/latest/develop/ai/redisvl/user_guide/session_manager/) - Session patterns
- [Notification System Design](https://www.magicbell.com/blog/notification-system-design) - Architecture patterns

### Tertiary (LOW confidence)
- [Telegram Inline Keyboard UX](https://wyu-telegram.com/blogs/444/) - UI patterns
- [Building Chatbots with Intent Detection](https://irisagent.com/blog/building-chatbots-with-intent-detection-guide/) - General patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs verified for grammY, community alternatives verified for WhatsApp
- Architecture: MEDIUM-HIGH - Patterns derived from framework docs and existing codebase patterns
- Intent detection: MEDIUM - LLM function calling is well-documented but domain-specific tuning may be needed
- Notifications: MEDIUM - Standard patterns but specific requirements may vary

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - bot frameworks relatively stable)

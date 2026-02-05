# Phase 4: Tasks & Deliverables - Research

**Researched:** 2026-02-05
**Domain:** Task management, deliverable blocks, custom fields, dependencies, status workflows, metrics aggregation
**Confidence:** HIGH

## Summary

Phase 4 implements the core project management data structures: tasks with subtasks, dependencies, and deliverable blocks with custom fields and status flows. The research addresses: task hierarchy (2-level nesting), cross-type dependencies with cycle detection, custom field storage with JSONB, configurable status workflows per deliverable type, and output metrics with time-based aggregation.

The standard approach for this domain combines:
- **Database schema:** Tasks and deliverables as separate tables with shared patterns; JSONB for custom field values; adjacency list with nesting limit for task hierarchy; junction table for dependencies
- **Dependency model:** Simple blocks/blocked-by with DFS-based cycle detection at creation time
- **Custom fields:** Field definitions at project level in separate table; field values as JSONB on tasks/deliverables
- **Status workflows:** Status definitions and transitions stored per deliverable type; validation at service layer
- **File uploads:** Bun's native S3 presigned URLs for proof file attachments
- **Metrics:** PostgreSQL aggregation queries with optional materialized views for dashboard performance

**Primary recommendation:** Use JSONB for custom field values (not EAV), simple blocks/blocked-by dependency type with DFS cycle detection, and compute metrics on-demand initially with materialized views added if needed for performance.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.30+ | Database queries/schema | Already in use, type-safe JSONB with $type |
| Bun S3 Client | native | File upload presigned URLs | Native Bun API, no external deps |
| Zod | 3.x | Validation for custom field values | Already in use, runtime validation for JSONB |
| dayjs | 1.x | Date manipulation for metrics | Lightweight, timezone support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @casl/ability | 6.x | Task/deliverable authorization | Already configured in Phase 2 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB custom fields | EAV tables | EAV is 3x more storage, JSONB 15-25x faster with GIN index |
| DFS cycle detection | Database constraint | Constraint can't check cross-table cycles |
| Simple blocks/blocked-by | Full dependency types (FS, SS, FF, SF) | Complexity not needed for most PM workflows |
| Bun S3 | AWS SDK | Bun native is lighter, sufficient for presigned URLs |
| dayjs | date-fns | Either works; dayjs has smaller bundle, plugins for duration |

**Installation:**
```bash
bun add dayjs
```

## Architecture Patterns

### Recommended Project Structure
```
src/features/
├── tasks/
│   ├── __tests__/
│   ├── tasks.routes.ts       # Task CRUD endpoints
│   ├── tasks.service.ts      # Task business logic
│   ├── tasks.types.ts        # Task type definitions
│   └── tasks.dependencies.ts # Dependency management + cycle detection
├── deliverables/
│   ├── __tests__/
│   ├── deliverables.routes.ts    # Deliverable CRUD endpoints
│   ├── deliverables.service.ts   # Deliverable business logic
│   ├── deliverables.types.ts     # Deliverable type definitions
│   └── deliverable-types.service.ts # Type definitions with status flows
├── custom-fields/
│   ├── __tests__/
│   ├── custom-fields.routes.ts   # Field definition management
│   ├── custom-fields.service.ts  # Field CRUD + validation
│   └── custom-fields.types.ts    # Field type definitions
├── uploads/
│   ├── __tests__/
│   ├── uploads.routes.ts     # Presigned URL generation
│   ├── uploads.service.ts    # S3 integration
│   └── uploads.types.ts      # Upload type definitions
└── metrics/
    ├── __tests__/
    ├── metrics.routes.ts     # Metrics query endpoints
    ├── metrics.service.ts    # Aggregation queries
    └── metrics.types.ts      # Metric type definitions

src/shared/
└── db/schema/
    ├── tasks.ts              # Tasks table
    ├── deliverables.ts       # Deliverables table
    ├── deliverable-types.ts  # Type definitions + status flows
    ├── custom-fields.ts      # Field definitions at project level
    ├── dependencies.ts       # Dependency junction table
    └── attachments.ts        # File attachment records
```

### Pattern 1: Task Schema with 2-Level Nesting
**What:** Tasks with subtasks, enforced 2-level nesting limit (Task -> Subtask -> Sub-subtask)
**When to use:** All task creation
**Example:**
```typescript
// src/shared/db/schema/tasks.ts
import { pgTable, uuid, varchar, text, timestamp, integer, type AnyPgColumn, jsonb } from 'drizzle-orm/pg-core';
import { pgEnum } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';
import { squads } from './squads';

export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'done']);

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  squadId: uuid('squad_id').references(() => squads.id, { onDelete: 'set null' }),

  // Hierarchy: null = top-level task
  parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id, { onDelete: 'cascade' }),
  // Track depth for nesting limit (0 = task, 1 = subtask, 2 = sub-subtask)
  depth: integer('depth').notNull().default(0),

  // Core fields
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  status: taskStatusEnum('status').notNull().default('todo'),

  // Assignment
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  createdById: uuid('created_by_id').notNull().references(() => users.id),

  // Dates
  dueDate: timestamp('due_date', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Custom field values (JSONB)
  customFieldValues: jsonb('custom_field_values').$type<Record<string, unknown>>().default({}),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Pattern 2: Deliverable Schema with Type Reference
**What:** Deliverables linked to a deliverable type that defines available fields and status flow
**When to use:** All deliverable creation
**Example:**
```typescript
// src/shared/db/schema/deliverables.ts
import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';
import { squads } from './squads';
import { deliverableTypes } from './deliverable-types';

export const deliverables = pgTable('deliverables', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  squadId: uuid('squad_id').references(() => squads.id, { onDelete: 'set null' }),
  deliverableTypeId: uuid('deliverable_type_id').notNull().references(() => deliverableTypes.id),

  // Core fields
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 100 }).notNull(), // Validated against type's status flow

  // Assignment
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  createdById: uuid('created_by_id').notNull().references(() => users.id),

  // Dates
  dueDate: timestamp('due_date', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Custom field values (JSONB) - validated against type's field definitions
  customFieldValues: jsonb('custom_field_values').$type<Record<string, unknown>>().default({}),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Pattern 3: Deliverable Type with Status Flow
**What:** Type definitions storing field schema and allowed status transitions
**When to use:** Admin configuring deliverable types
**Example:**
```typescript
// src/shared/db/schema/deliverable-types.ts
import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { projects } from './projects';

// Field type enum
export const fieldTypes = ['text', 'number', 'date', 'select', 'multi_select', 'url', 'file', 'relation'] as const;

// Status definition with transitions
export interface StatusDefinition {
  id: string;
  name: string;
  color: string; // hex color for UI
  isFinal: boolean; // true = counts as "done" for metrics
}

export interface StatusTransition {
  from: string; // status id
  to: string;   // status id
}

export interface FieldDefinition {
  id: string;
  name: string;
  type: typeof fieldTypes[number];
  required: boolean;
  options?: string[]; // For select/multi_select
  relationTo?: 'task' | 'deliverable'; // For relation type
}

export interface DeliverableTypeConfig {
  statuses: StatusDefinition[];
  transitions: StatusTransition[];
  fields: FieldDefinition[];
}

export const deliverableTypes = pgTable('deliverable_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 50 }), // emoji or icon name

  // Configuration stored as JSONB
  config: jsonb('config').$type<DeliverableTypeConfig>().notNull(),

  // Preset flag - true for system templates
  isPreset: boolean('is_preset').notNull().default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Pattern 4: Cross-Type Dependencies with Cycle Detection
**What:** Dependencies between tasks and deliverables with DFS cycle detection
**When to use:** Creating any dependency
**Example:**
```typescript
// src/shared/db/schema/dependencies.ts
import { pgTable, uuid, timestamp, varchar, unique } from 'drizzle-orm/pg-core';

// Polymorphic: can reference task or deliverable
export const dependencies = pgTable('dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Blocker (the item that blocks)
  blockerType: varchar('blocker_type', { length: 20 }).notNull(), // 'task' | 'deliverable'
  blockerId: uuid('blocker_id').notNull(),

  // Blocked (the item that is blocked)
  blockedType: varchar('blocked_type', { length: 20 }).notNull(), // 'task' | 'deliverable'
  blockedId: uuid('blocked_id').notNull(),

  createdById: uuid('created_by_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Prevent duplicate dependencies
  uniqueDependency: unique().on(table.blockerType, table.blockerId, table.blockedType, table.blockedId),
}));

// src/features/tasks/tasks.dependencies.ts
import { eq, and, or } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { ApiError } from '../../shared/middleware/error-handler';

interface DependencyNode {
  type: 'task' | 'deliverable';
  id: string;
}

/**
 * DFS-based cycle detection for dependency graph.
 * Returns true if adding edge from->to would create a cycle.
 */
export async function wouldCreateCycle(
  from: DependencyNode,
  to: DependencyNode
): Promise<boolean> {
  // If from equals to, immediate cycle
  if (from.type === to.type && from.id === to.id) {
    return true;
  }

  // DFS from "to" to see if we can reach "from"
  const visited = new Set<string>();
  const stack = [to];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const key = `${current.type}:${current.id}`;

    if (visited.has(key)) continue;
    visited.add(key);

    // Get all items blocked by current (current blocks them)
    const outgoing = await db.query.dependencies.findMany({
      where: and(
        eq(schema.dependencies.blockerType, current.type),
        eq(schema.dependencies.blockerId, current.id)
      ),
    });

    for (const dep of outgoing) {
      // If we reach "from", adding the edge would create a cycle
      if (dep.blockedType === from.type && dep.blockedId === from.id) {
        return true;
      }
      stack.push({ type: dep.blockedType as 'task' | 'deliverable', id: dep.blockedId });
    }
  }

  return false;
}

/**
 * Creates a dependency after validating no cycle would be created.
 */
export async function createDependency(
  blocker: DependencyNode,
  blocked: DependencyNode,
  createdById: string
) {
  // Check for cycle
  if (await wouldCreateCycle(blocker, blocked)) {
    throw new ApiError(
      400,
      'dependencies/cycle-detected',
      'Circular Dependency Detected',
      'Adding this dependency would create a circular reference'
    );
  }

  const [dependency] = await db.insert(schema.dependencies).values({
    blockerType: blocker.type,
    blockerId: blocker.id,
    blockedType: blocked.type,
    blockedId: blocked.id,
    createdById,
  }).returning();

  return dependency;
}
```

### Pattern 5: Custom Field Definitions and Validation
**What:** Project-level field library with runtime validation of values
**When to use:** Managing custom fields
**Example:**
```typescript
// src/shared/db/schema/custom-fields.ts
import { pgTable, uuid, varchar, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { projects } from './projects';

export interface FieldConfig {
  options?: string[];         // For select/multi_select
  min?: number;               // For number
  max?: number;               // For number
  relationTo?: 'task' | 'deliverable'; // For relation
  allowMultiple?: boolean;    // For file attachments
}

export const customFields = pgTable('custom_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // text, number, date, select, multi_select, url, file, relation
  config: jsonb('config').$type<FieldConfig>().default({}),
  required: boolean('required').notNull().default(false),

  // Can apply to tasks, deliverables, or both
  appliesToTasks: boolean('applies_to_tasks').notNull().default(true),
  appliesToDeliverables: boolean('applies_to_deliverables').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// src/features/custom-fields/custom-fields.service.ts
import { z } from 'zod';

/**
 * Build Zod schema for custom field validation
 */
export function buildFieldValidator(field: typeof customFields.$inferSelect): z.ZodTypeAny {
  switch (field.type) {
    case 'text':
      return z.string();
    case 'number':
      let numSchema = z.number();
      if (field.config?.min !== undefined) numSchema = numSchema.min(field.config.min);
      if (field.config?.max !== undefined) numSchema = numSchema.max(field.config.max);
      return numSchema;
    case 'date':
      return z.string().datetime(); // ISO string
    case 'select':
      return z.enum(field.config?.options as [string, ...string[]] ?? ['']);
    case 'multi_select':
      return z.array(z.enum(field.config?.options as [string, ...string[]] ?? ['']));
    case 'url':
      return z.string().url();
    case 'file':
      return z.object({
        attachmentId: z.string().uuid(),
        filename: z.string(),
        url: z.string().url(),
      });
    case 'relation':
      return z.string().uuid(); // ID of related item
    default:
      return z.unknown();
  }
}

/**
 * Validate custom field values against field definitions
 */
export async function validateCustomFieldValues(
  projectId: string,
  values: Record<string, unknown>,
  target: 'task' | 'deliverable'
): Promise<{ valid: boolean; errors: string[] }> {
  const fields = await db.query.customFields.findMany({
    where: and(
      eq(schema.customFields.projectId, projectId),
      target === 'task'
        ? eq(schema.customFields.appliesToTasks, true)
        : eq(schema.customFields.appliesToDeliverables, true)
    ),
  });

  const errors: string[] = [];

  for (const field of fields) {
    const value = values[field.id];

    // Check required
    if (field.required && (value === undefined || value === null)) {
      errors.push(`Field "${field.name}" is required`);
      continue;
    }

    // Validate type if value present
    if (value !== undefined && value !== null) {
      const validator = buildFieldValidator(field);
      const result = validator.safeParse(value);
      if (!result.success) {
        errors.push(`Field "${field.name}": ${result.error.message}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### Pattern 6: Presigned URL File Uploads
**What:** Generate presigned URLs for direct S3 upload
**When to use:** Proof file attachments
**Example:**
```typescript
// src/features/uploads/uploads.service.ts
import { S3Client } from 'bun';
import { db, schema } from '../../shared/db';
import { env } from '../../shared/lib/env';
import { nanoid } from 'nanoid';

const s3 = new S3Client({
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  bucket: env.S3_BUCKET,
  endpoint: env.S3_ENDPOINT,
});

interface PresignedUploadResult {
  uploadUrl: string;
  attachmentId: string;
  expiresAt: Date;
}

/**
 * Generate presigned URL for file upload
 */
export async function createUploadUrl(
  userId: string,
  filename: string,
  contentType: string,
  targetType: 'task' | 'deliverable',
  targetId: string
): Promise<PresignedUploadResult> {
  const attachmentId = nanoid();
  const key = `attachments/${targetType}/${targetId}/${attachmentId}/${filename}`;

  const expiresIn = 3600; // 1 hour
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const uploadUrl = await s3.presign(key, {
    method: 'PUT',
    expiresIn,
    type: contentType,
  });

  // Record pending upload
  await db.insert(schema.attachments).values({
    id: attachmentId,
    targetType,
    targetId,
    filename,
    contentType,
    s3Key: key,
    uploadedById: userId,
    status: 'pending', // Will be 'completed' after upload confirmation
  });

  return { uploadUrl, attachmentId, expiresAt };
}

/**
 * Confirm upload completed and generate download URL
 */
export async function confirmUpload(attachmentId: string): Promise<string> {
  const attachment = await db.query.attachments.findFirst({
    where: eq(schema.attachments.id, attachmentId),
  });

  if (!attachment) {
    throw new ApiError(404, 'uploads/not-found', 'Attachment Not Found');
  }

  // Verify file exists in S3
  const exists = await s3.file(attachment.s3Key).exists();
  if (!exists) {
    throw new ApiError(400, 'uploads/not-uploaded', 'File Not Uploaded', 'The file was not uploaded to the provided URL');
  }

  // Update status
  await db.update(schema.attachments)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(schema.attachments.id, attachmentId));

  // Return download URL (long expiry for viewing)
  return s3.presign(attachment.s3Key, {
    method: 'GET',
    expiresIn: 86400 * 7, // 7 days
  });
}
```

### Pattern 7: Metrics Aggregation
**What:** Compute output metrics per person, squad, time period
**When to use:** Dashboard metrics queries
**Example:**
```typescript
// src/features/metrics/metrics.service.ts
import { sql, eq, and, gte, lte, count } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import dayjs from 'dayjs';

interface OutputMetrics {
  totalCompleted: number;
  byDay: Array<{ date: string; count: number }>;
  byPerson: Array<{ userId: string; name: string; count: number }>;
  bySquad: Array<{ squadId: string; name: string; count: number }>;
}

/**
 * Get output metrics for a time range
 */
export async function getOutputMetrics(
  projectId: string,
  startDate: Date,
  endDate: Date,
  squadId?: string
): Promise<OutputMetrics> {
  // Base conditions
  const conditions = [
    eq(schema.tasks.projectId, projectId),
    eq(schema.tasks.status, 'done'),
    gte(schema.tasks.completedAt, startDate),
    lte(schema.tasks.completedAt, endDate),
  ];

  if (squadId) {
    conditions.push(eq(schema.tasks.squadId, squadId));
  }

  // Total completed tasks
  const [taskTotal] = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(and(...conditions));

  // Similar for deliverables
  const deliverableConditions = [
    eq(schema.deliverables.projectId, projectId),
    gte(schema.deliverables.completedAt, startDate),
    lte(schema.deliverables.completedAt, endDate),
  ];

  if (squadId) {
    deliverableConditions.push(eq(schema.deliverables.squadId, squadId));
  }

  // Need to check if status is "final" based on deliverable type config
  // This requires joining with deliverable_types
  const completedDeliverables = await db.execute(sql`
    SELECT COUNT(*) as count FROM deliverables d
    JOIN deliverable_types dt ON d.deliverable_type_id = dt.id
    WHERE d.project_id = ${projectId}
      AND d.completed_at >= ${startDate}
      AND d.completed_at <= ${endDate}
      ${squadId ? sql`AND d.squad_id = ${squadId}` : sql``}
  `);

  // By day aggregation
  const byDay = await db.execute(sql`
    SELECT DATE(completed_at) as date, COUNT(*) as count
    FROM (
      SELECT completed_at FROM tasks
      WHERE project_id = ${projectId} AND status = 'done'
        AND completed_at >= ${startDate} AND completed_at <= ${endDate}
        ${squadId ? sql`AND squad_id = ${squadId}` : sql``}
      UNION ALL
      SELECT d.completed_at FROM deliverables d
      JOIN deliverable_types dt ON d.deliverable_type_id = dt.id
      WHERE d.project_id = ${projectId}
        AND d.completed_at >= ${startDate} AND d.completed_at <= ${endDate}
        ${squadId ? sql`AND d.squad_id = ${squadId}` : sql``}
    ) combined
    GROUP BY DATE(completed_at)
    ORDER BY date
  `);

  // By person (similar pattern)
  const byPerson = await db.execute(sql`
    SELECT assignee_id as user_id, u.email as name, COUNT(*) as count
    FROM tasks t
    JOIN users u ON t.assignee_id = u.id
    WHERE t.project_id = ${projectId} AND t.status = 'done'
      AND t.completed_at >= ${startDate} AND t.completed_at <= ${endDate}
      ${squadId ? sql`AND t.squad_id = ${squadId}` : sql``}
      AND t.assignee_id IS NOT NULL
    GROUP BY assignee_id, u.email
    ORDER BY count DESC
  `);

  // By squad (similar pattern)
  const bySquad = await db.execute(sql`
    SELECT t.squad_id, s.name, COUNT(*) as count
    FROM tasks t
    JOIN squads s ON t.squad_id = s.id
    WHERE t.project_id = ${projectId} AND t.status = 'done'
      AND t.completed_at >= ${startDate} AND t.completed_at <= ${endDate}
      AND t.squad_id IS NOT NULL
    GROUP BY t.squad_id, s.name
    ORDER BY count DESC
  `);

  return {
    totalCompleted: (taskTotal?.count ?? 0) + Number(completedDeliverables.rows[0]?.count ?? 0),
    byDay: byDay.rows as Array<{ date: string; count: number }>,
    byPerson: byPerson.rows as Array<{ userId: string; name: string; count: number }>,
    bySquad: bySquad.rows as Array<{ squadId: string; name: string; count: number }>,
  };
}

/**
 * Calculate velocity (completed items per time period)
 */
export async function getVelocity(
  projectId: string,
  periodDays: number = 7,
  numPeriods: number = 4
): Promise<Array<{ periodStart: Date; periodEnd: Date; velocity: number }>> {
  const results = [];
  const now = dayjs();

  for (let i = 0; i < numPeriods; i++) {
    const periodEnd = now.subtract(i * periodDays, 'day').endOf('day').toDate();
    const periodStart = now.subtract((i + 1) * periodDays, 'day').startOf('day').toDate();

    const metrics = await getOutputMetrics(projectId, periodStart, periodEnd);
    results.push({
      periodStart,
      periodEnd,
      velocity: metrics.totalCompleted,
    });
  }

  return results.reverse(); // Oldest first
}

/**
 * Burndown chart data - remaining work over time
 */
export async function getBurndownData(
  projectId: string,
  startDate: Date,
  endDate: Date,
  squadId?: string
): Promise<Array<{ date: string; remaining: number; ideal: number }>> {
  // Get total items at start
  const conditions = [eq(schema.tasks.projectId, projectId)];
  if (squadId) conditions.push(eq(schema.tasks.squadId, squadId));

  const [totalTasks] = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(and(...conditions, lte(schema.tasks.createdAt, startDate)));

  const totalWork = totalTasks?.count ?? 0;

  // Calculate ideal burndown (linear)
  const totalDays = dayjs(endDate).diff(dayjs(startDate), 'day');
  const dailyIdealBurn = totalWork / totalDays;

  // Get actual remaining by day
  const burndownData = [];
  let current = dayjs(startDate);

  while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
    const dayEnd = current.endOf('day').toDate();

    // Count completed by this day
    const [completed] = await db
      .select({ count: count() })
      .from(schema.tasks)
      .where(and(
        ...conditions,
        eq(schema.tasks.status, 'done'),
        lte(schema.tasks.completedAt, dayEnd)
      ));

    const dayIndex = current.diff(dayjs(startDate), 'day');

    burndownData.push({
      date: current.format('YYYY-MM-DD'),
      remaining: totalWork - (completed?.count ?? 0),
      ideal: Math.max(0, totalWork - (dailyIdealBurn * dayIndex)),
    });

    current = current.add(1, 'day');
  }

  return burndownData;
}
```

### Anti-Patterns to Avoid
- **EAV for custom fields:** Use JSONB instead - 3x less storage, 15-25x faster queries
- **Database triggers for cycle detection:** Can't check cross-table dependencies; use application-level DFS
- **Storing files in database:** Use S3 presigned URLs for scalable file storage
- **Unbounded subtask nesting:** Enforce 2-level limit to prevent deep recursion
- **Status as free-text:** Use deliverable type's status flow for consistency
- **Computing metrics on every request:** Consider caching or materialized views for dashboards

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cycle detection | Recursive SQL CTEs | DFS in application | Cross-table deps, better error messages |
| File uploads | Multipart handlers | S3 presigned URLs | Scalable, offloads from server |
| Date math | Manual calculations | dayjs | Timezone edge cases, duration handling |
| JSONB validation | Manual type checking | Zod schemas | Runtime validation, clear errors |
| Status transitions | If/else chains | Config-driven validation | Maintainable, customizable per type |

**Key insight:** Custom fields in PM tools look simple but have many edge cases (required validation, type coercion, relation lookups). JSONB with Zod validation provides flexibility without EAV complexity.

## Common Pitfalls

### Pitfall 1: Subtask Nesting Runaway
**What goes wrong:** Deep task hierarchies become unnavigable
**Why it happens:** No enforced nesting limit
**How to avoid:** Enforce 2-level max at service layer with depth field
**Warning signs:** Tasks with depth > 2, slow recursive queries

### Pitfall 2: Orphaned Dependencies
**What goes wrong:** Dependencies point to deleted items
**Why it happens:** No cascade delete, or polymorphic references not handled
**How to avoid:** Application-level cleanup on task/deliverable delete, or soft delete
**Warning signs:** Foreign key violations, 500 errors on dependency queries

### Pitfall 3: Invalid Status Transitions
**What goes wrong:** Items in states that violate the configured flow
**Why it happens:** Direct database updates, or stale type config
**How to avoid:** Always validate transitions through service layer against current type config
**Warning signs:** Items stuck in invalid states, metric discrepancies

### Pitfall 4: Metrics Query Performance
**What goes wrong:** Dashboard timeouts on large datasets
**Why it happens:** Aggregating over full history on every request
**How to avoid:** Add indexes on (project_id, status, completed_at), consider materialized views
**Warning signs:** Increasing query times as data grows

### Pitfall 5: File Upload Race Conditions
**What goes wrong:** Attachment record created but file never uploaded
**Why it happens:** No confirmation step, presigned URL expires
**How to avoid:** Use pending/completed status, cleanup job for stale pending uploads
**Warning signs:** Broken attachment links, storage growing with orphan files

### Pitfall 6: Custom Field Type Changes
**What goes wrong:** Existing values incompatible with new field type
**Why it happens:** Changing field type after data exists
**How to avoid:** Prevent type changes if values exist, or provide migration path
**Warning signs:** Validation errors on existing items, corrupted JSONB

## Code Examples

### Preset Deliverable Type Templates
```typescript
// src/features/deliverables/deliverable-presets.ts

export const PRESET_TEMPLATES: Record<string, Omit<DeliverableTypeConfig, 'fields'> & { fields: FieldDefinition[] }> = {
  // Generic PM types
  bug: {
    statuses: [
      { id: 'open', name: 'Open', color: '#EF4444', isFinal: false },
      { id: 'in_progress', name: 'In Progress', color: '#F59E0B', isFinal: false },
      { id: 'testing', name: 'Testing', color: '#8B5CF6', isFinal: false },
      { id: 'resolved', name: 'Resolved', color: '#10B981', isFinal: true },
      { id: 'closed', name: 'Closed', color: '#6B7280', isFinal: true },
    ],
    transitions: [
      { from: 'open', to: 'in_progress' },
      { from: 'in_progress', to: 'testing' },
      { from: 'testing', to: 'resolved' },
      { from: 'testing', to: 'in_progress' }, // Back to dev
      { from: 'resolved', to: 'closed' },
      { from: 'resolved', to: 'open' }, // Reopen
    ],
    fields: [
      { id: 'severity', name: 'Severity', type: 'select', required: true, options: ['critical', 'major', 'minor', 'trivial'] },
      { id: 'environment', name: 'Environment', type: 'select', required: false, options: ['production', 'staging', 'development'] },
      { id: 'steps_to_reproduce', name: 'Steps to Reproduce', type: 'text', required: false },
    ],
  },

  feature: {
    statuses: [
      { id: 'backlog', name: 'Backlog', color: '#6B7280', isFinal: false },
      { id: 'spec', name: 'Specification', color: '#3B82F6', isFinal: false },
      { id: 'design', name: 'Design', color: '#8B5CF6', isFinal: false },
      { id: 'development', name: 'Development', color: '#F59E0B', isFinal: false },
      { id: 'review', name: 'Review', color: '#EC4899', isFinal: false },
      { id: 'done', name: 'Done', color: '#10B981', isFinal: true },
    ],
    transitions: [
      { from: 'backlog', to: 'spec' },
      { from: 'spec', to: 'design' },
      { from: 'design', to: 'development' },
      { from: 'development', to: 'review' },
      { from: 'review', to: 'done' },
      { from: 'review', to: 'development' }, // Back for changes
    ],
    fields: [
      { id: 'epic', name: 'Epic', type: 'relation', required: false, relationTo: 'deliverable' },
      { id: 'story_points', name: 'Story Points', type: 'number', required: false },
    ],
  },

  // Content types
  article: {
    statuses: [
      { id: 'ideation', name: 'Ideation', color: '#6B7280', isFinal: false },
      { id: 'outline', name: 'Outline', color: '#3B82F6', isFinal: false },
      { id: 'writing', name: 'Writing', color: '#F59E0B', isFinal: false },
      { id: 'editing', name: 'Editing', color: '#8B5CF6', isFinal: false },
      { id: 'review', name: 'Review', color: '#EC4899', isFinal: false },
      { id: 'published', name: 'Published', color: '#10B981', isFinal: true },
    ],
    transitions: [
      { from: 'ideation', to: 'outline' },
      { from: 'outline', to: 'writing' },
      { from: 'writing', to: 'editing' },
      { from: 'editing', to: 'review' },
      { from: 'review', to: 'published' },
      { from: 'review', to: 'editing' }, // Back for revisions
    ],
    fields: [
      { id: 'word_count', name: 'Target Word Count', type: 'number', required: false },
      { id: 'topic', name: 'Topic', type: 'text', required: true },
      { id: 'publish_url', name: 'Published URL', type: 'url', required: false },
    ],
  },

  video: {
    statuses: [
      { id: 'ideation', name: 'Ideation', color: '#6B7280', isFinal: false },
      { id: 'scripting', name: 'Scripting', color: '#3B82F6', isFinal: false },
      { id: 'production', name: 'Production', color: '#F59E0B', isFinal: false },
      { id: 'editing', name: 'Editing', color: '#8B5CF6', isFinal: false },
      { id: 'review', name: 'Review', color: '#EC4899', isFinal: false },
      { id: 'published', name: 'Published', color: '#10B981', isFinal: true },
    ],
    transitions: [
      { from: 'ideation', to: 'scripting' },
      { from: 'scripting', to: 'production' },
      { from: 'production', to: 'editing' },
      { from: 'editing', to: 'review' },
      { from: 'review', to: 'published' },
      { from: 'review', to: 'editing' },
    ],
    fields: [
      { id: 'platform', name: 'Platform', type: 'select', required: true, options: ['YouTube', 'TikTok', 'Instagram', 'Other'] },
      { id: 'duration', name: 'Target Duration', type: 'text', required: false },
      { id: 'publish_url', name: 'Published URL', type: 'url', required: false },
      { id: 'thumbnail', name: 'Thumbnail', type: 'file', required: false },
    ],
  },

  social_post: {
    statuses: [
      { id: 'draft', name: 'Draft', color: '#6B7280', isFinal: false },
      { id: 'review', name: 'Review', color: '#8B5CF6', isFinal: false },
      { id: 'scheduled', name: 'Scheduled', color: '#3B82F6', isFinal: false },
      { id: 'published', name: 'Published', color: '#10B981', isFinal: true },
    ],
    transitions: [
      { from: 'draft', to: 'review' },
      { from: 'review', to: 'scheduled' },
      { from: 'review', to: 'draft' },
      { from: 'scheduled', to: 'published' },
    ],
    fields: [
      { id: 'platform', name: 'Platform', type: 'multi_select', required: true, options: ['Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'Threads'] },
      { id: 'scheduled_date', name: 'Scheduled Date', type: 'date', required: false },
      { id: 'media', name: 'Media', type: 'file', required: false },
    ],
  },

  design: {
    statuses: [
      { id: 'brief', name: 'Brief', color: '#6B7280', isFinal: false },
      { id: 'exploration', name: 'Exploration', color: '#3B82F6', isFinal: false },
      { id: 'refinement', name: 'Refinement', color: '#F59E0B', isFinal: false },
      { id: 'review', name: 'Review', color: '#8B5CF6', isFinal: false },
      { id: 'approved', name: 'Approved', color: '#10B981', isFinal: true },
    ],
    transitions: [
      { from: 'brief', to: 'exploration' },
      { from: 'exploration', to: 'refinement' },
      { from: 'refinement', to: 'review' },
      { from: 'review', to: 'approved' },
      { from: 'review', to: 'refinement' },
    ],
    fields: [
      { id: 'design_type', name: 'Design Type', type: 'select', required: true, options: ['UI/UX', 'Graphic', 'Illustration', 'Brand', 'Other'] },
      { id: 'figma_url', name: 'Figma URL', type: 'url', required: false },
      { id: 'final_files', name: 'Final Files', type: 'file', required: false },
    ],
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| EAV for custom fields | JSONB with GIN index | 2018+ | 15-25x faster queries |
| Full dependency types (FS/SS/FF/SF) | Simple blocks/blocked-by | Modern trend | Covers 95% of use cases |
| State machine libraries | Config-driven validation | Context-dependent | Libraries for complex flows, config for simple |
| Compute metrics on read | Materialized views + refresh | Scale-dependent | Sub-100ms dashboard loads |
| SDK-based S3 | Native runtime support (Bun) | 2024+ | Lighter dependencies |

**Deprecated/outdated:**
- **EAV tables for custom fields:** JSONB is significantly faster and uses less storage
- **Complex dependency types by default:** Start simple, add if needed
- **File storage in database BLOBs:** Always use object storage

## Discretionary Recommendations

Based on CONTEXT.md Claude's Discretion items:

### Dependency Type Implementation
**Recommendation:** Simple blocks/blocked-by
**Rationale:**
- Finish-to-start (FS) dependencies cover 95%+ of real PM needs
- Other types (Start-to-Start, Finish-to-Finish, Start-to-Finish) add UI complexity with minimal benefit
- Can always extend later if users request
- Cross-type (task blocks deliverable) is the unique requirement here

### Preset Template Field Configurations
**Recommendation:** See code examples above for Bug, Feature, Article, Video, Social Post, Design presets
**Rationale:**
- Generic PM types (Bug, Feature) are Jira-like with severity, story points
- Content types (Article, Video) include platform-specific fields
- All presets can be customized by admins
- Sensible status flows based on common workflows

### Metrics Calculation/Caching Strategy
**Recommendation:** Start with on-demand queries; add materialized views if performance degrades
**Rationale:**
- PostgreSQL can handle aggregation queries efficiently up to ~100k rows
- Premature optimization adds complexity
- Add indexes on (project_id, status, completed_at, squad_id)
- If dashboard response >500ms, create materialized views refreshed hourly
- pg_cron for scheduled refresh or application job

### Burndown Chart Algorithm
**Recommendation:** Linear ideal line with scope tracking
**Rationale:**
- Calculate total work at period start
- Ideal = linear decrease from total to 0 over period
- Actual = total minus completed as of each day
- Track scope changes (new items added) separately to show accurate burn
- Don't overcomplicate: sprint-based burndown assumes fixed scope

## Open Questions

1. **Soft Delete vs Hard Delete**
   - What we know: Dependencies need cleanup, metrics need historical data
   - What's unclear: Should tasks/deliverables soft delete or hard delete?
   - Recommendation: Soft delete (add deletedAt field) for audit trail; hard delete after 90 days via cleanup job

2. **S3 Configuration**
   - What we know: Bun has native S3 support
   - What's unclear: Which provider to default to (AWS, R2, MinIO)?
   - Recommendation: Add S3_* env vars for endpoint, bucket, access/secret; default to MinIO for local dev

3. **Metrics Rollup Scheduling**
   - What we know: Daily/weekly/monthly views needed
   - What's unclear: When to pre-compute vs compute on demand
   - Recommendation: Start on-demand; add pg_cron materialized view refresh at 3AM daily if needed

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - PostgreSQL Column Types](https://orm.drizzle.team/docs/column-types/pg) - JSONB with $type
- [Bun S3 Documentation](https://bun.com/docs/runtime/s3) - Native presigned URL API
- [Topological Sort - GeeksforGeeks](https://www.geeksforgeeks.org/dsa/topological-sorting/) - DFS cycle detection
- [CASL Documentation](https://casl.js.org/) - Already in use from Phase 2

### Secondary (MEDIUM confidence)
- [PostgreSQL JSONB vs. EAV](https://www.razsamuel.com/postgresql-jsonb-vs-eav-dynamic-data/) - Performance comparison
- [Burndown Chart in Scrum](https://www.scrum-institute.org/Burndown_Chart.php) - Algorithm reference
- [TimescaleDB Continuous Aggregates](https://oneuptime.com/blog/post/2026-01-27-timescaledb-continuous-aggregates/view) - Metrics optimization
- [XState v5 TypeScript](https://stately.ai/docs/typescript) - State machine patterns (reference, not used)

### Tertiary (LOW confidence)
- [Building a Minimal Jira Alternative](https://hulry.com/notion-project-tracker/) - Schema inspiration
- [Cloudflare R2 Presigned URL Uploads with Hono](https://lirantal.com/blog/cloudflare-r2-presigned-url-uploads-hono) - Implementation example

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - JSONB and S3 patterns well-documented
- Database schema: HIGH - Patterns from existing codebase + PM tool research
- Dependency cycle detection: HIGH - Standard DFS algorithm
- Metrics aggregation: MEDIUM - Strategy depends on scale
- Preset templates: MEDIUM - Based on common PM workflows, may need adjustment

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days - domain is stable)

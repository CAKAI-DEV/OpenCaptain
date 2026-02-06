import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { escalationBlocks } from './escalation-blocks';
import { projects } from './projects';
import { tasks } from './tasks';
import { users } from './users';

/**
 * Blocker status - tracking lifecycle of reported blockers
 */
export type BlockerStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';

/**
 * Blockers - user-reported obstacles to task completion
 */
export const blockers = pgTable(
  'blockers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Who reported and what they're blocked on
    reportedById: uuid('reported_by_id')
      .notNull()
      .references(() => users.id),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),

    // Blocker details
    description: text('description').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('open'),

    // Resolution tracking
    resolvedById: uuid('resolved_by_id').references(() => users.id),
    resolutionNote: text('resolution_note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('blockers_project_id_idx').on(table.projectId),
    index('blockers_reported_by_id_idx').on(table.reportedById),
    index('blockers_status_idx').on(table.status),
    index('blockers_task_id_idx').on(table.taskId),
    index('blockers_created_at_idx').on(table.createdAt),
  ]
);

export const blockersRelations = relations(blockers, ({ one }) => ({
  project: one(projects, {
    fields: [blockers.projectId],
    references: [projects.id],
  }),
  reportedBy: one(users, {
    fields: [blockers.reportedById],
    references: [users.id],
    relationName: 'reporter',
  }),
  resolvedBy: one(users, {
    fields: [blockers.resolvedById],
    references: [users.id],
    relationName: 'resolver',
  }),
  task: one(tasks, {
    fields: [blockers.taskId],
    references: [tasks.id],
  }),
}));

/**
 * Escalation instances - tracking active escalation chains for blockers
 */
export const escalationInstances = pgTable(
  'escalation_instances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    escalationBlockId: uuid('escalation_block_id')
      .notNull()
      .references(() => escalationBlocks.id, { onDelete: 'cascade' }),

    // What triggered this escalation
    triggerType: varchar('trigger_type', { length: 50 }).notNull(),
    blockerId: uuid('blocker_id').references(() => blockers.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),

    // Chain progress
    currentStep: integer('current_step').notNull().default(0),
    status: varchar('status', { length: 20 }).notNull().default('active'), // active, resolved, cancelled

    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    lastEscalatedAt: timestamp('last_escalated_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('escalation_instances_project_id_idx').on(table.projectId),
    index('escalation_instances_blocker_id_idx').on(table.blockerId),
    index('escalation_instances_status_idx').on(table.status),
    index('escalation_instances_target_user_id_idx').on(table.targetUserId),
    index('escalation_instances_started_at_idx').on(table.startedAt),
  ]
);

export const escalationInstancesRelations = relations(escalationInstances, ({ one }) => ({
  project: one(projects, {
    fields: [escalationInstances.projectId],
    references: [projects.id],
  }),
  escalationBlock: one(escalationBlocks, {
    fields: [escalationInstances.escalationBlockId],
    references: [escalationBlocks.id],
  }),
  blocker: one(blockers, {
    fields: [escalationInstances.blockerId],
    references: [blockers.id],
  }),
  targetUser: one(users, {
    fields: [escalationInstances.targetUserId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [escalationInstances.taskId],
    references: [tasks.id],
  }),
}));

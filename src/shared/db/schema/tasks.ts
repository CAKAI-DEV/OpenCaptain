import {
  type AnyPgColumn,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { squads } from './squads';
import { users } from './users';

export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'done']);

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  squadId: uuid('squad_id').references(() => squads.id, { onDelete: 'set null' }),

  // Hierarchy: null = top-level task
  parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id, {
    onDelete: 'cascade',
  }),
  // Track depth for nesting limit (0 = task, 1 = subtask, 2 = sub-subtask)
  depth: integer('depth').notNull().default(0),

  // Core fields
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  status: taskStatusEnum('status').notNull().default('todo'),

  // Assignment
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id),

  // Dates
  dueDate: timestamp('due_date', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Custom field values (JSONB)
  customFieldValues: jsonb('custom_field_values').$type<Record<string, unknown>>().default({}),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

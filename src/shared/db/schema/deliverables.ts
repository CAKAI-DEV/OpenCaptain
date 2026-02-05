import { jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { deliverableTypes } from './deliverable-types';
import { projects } from './projects';
import { squads } from './squads';
import { users } from './users';

export const deliverables = pgTable('deliverables', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  squadId: uuid('squad_id').references(() => squads.id, { onDelete: 'set null' }),
  deliverableTypeId: uuid('deliverable_type_id')
    .notNull()
    .references(() => deliverableTypes.id),

  // Core fields
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 100 }).notNull(), // Validated against type's status flow at service layer

  // Assignment
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id),

  // Dates
  dueDate: timestamp('due_date', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Custom field values (JSONB) - validated against type's field definitions
  customFieldValues: jsonb('custom_field_values').$type<Record<string, unknown>>().default({}),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

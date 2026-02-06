import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { projects } from './projects';

// Store workflow nodes and edges as JSONB (flexible, matches React Flow structure)
export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' })
    .unique(), // One workflow per project
  name: text('name').notNull().default('Default Workflow'),
  nodes: jsonb('nodes').notNull().default([]),
  edges: jsonb('edges').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

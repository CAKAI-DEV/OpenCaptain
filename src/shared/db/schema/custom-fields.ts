import { boolean, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from './projects';

/**
 * Configuration options for custom field types.
 */
export interface FieldConfig {
  /** Options for select/multi_select types */
  options?: string[];
  /** Minimum value for number type */
  min?: number;
  /** Maximum value for number type */
  max?: number;
  /** Target type for relation fields */
  relationTo?: 'task' | 'deliverable';
  /** Allow multiple files for file type */
  allowMultiple?: boolean;
}

/**
 * Custom field definitions at project level.
 * Field values are stored as JSONB on tasks and deliverables.
 */
export const customFields = pgTable('custom_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 255 }).notNull(),
  /** Field type: text, number, date, select, multi_select, url, file, relation */
  type: varchar('type', { length: 50 }).notNull(),
  config: jsonb('config').$type<FieldConfig>().default({}),
  required: boolean('required').notNull().default(false),

  /** Whether this field applies to tasks */
  appliesToTasks: boolean('applies_to_tasks').notNull().default(true),
  /** Whether this field applies to deliverables */
  appliesToDeliverables: boolean('applies_to_deliverables').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

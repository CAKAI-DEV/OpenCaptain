import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from './projects';

// Field types available for custom fields
export const fieldTypes = [
  'text',
  'number',
  'date',
  'select',
  'multi_select',
  'url',
  'file',
  'relation',
] as const;

export type FieldType = (typeof fieldTypes)[number];

// Status definition with visual properties
export interface StatusDefinition {
  id: string;
  name: string;
  color: string; // hex color for UI
  isFinal: boolean; // true = counts as "done" for metrics
}

// Allowed transition between statuses
export interface StatusTransition {
  from: string; // status id
  to: string; // status id
}

// Custom field definition
export interface FieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // For select/multi_select
  relationTo?: 'task' | 'deliverable'; // For relation type
}

// Complete deliverable type configuration
export interface DeliverableTypeConfig {
  statuses: StatusDefinition[];
  transitions: StatusTransition[];
  fields: FieldDefinition[];
}

export const deliverableTypes = pgTable('deliverable_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

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

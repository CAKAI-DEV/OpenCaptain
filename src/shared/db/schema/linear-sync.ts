import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { tasks } from './tasks';

/**
 * Sync direction for Linear integration.
 */
export const linearSyncDirectionEnum = pgEnum('linear_sync_direction', [
  'to_linear',
  'from_linear',
  'bidirectional',
]);

/**
 * Linear integration configuration per project.
 * Stores API key (encrypted at rest), team ID, and status mappings.
 */
export const linearIntegrations = pgTable('linear_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // API credentials (should be encrypted at application level)
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  teamId: varchar('team_id', { length: 100 }).notNull(),

  // Status mappings: OpenCaptain status -> Linear state ID
  statusMappings: jsonb('status_mappings')
    .$type<
      Array<{
        blockbotStatus: 'todo' | 'in_progress' | 'done';
        linearStateId: string;
        linearStateName: string;
      }>
    >()
    .default([]),

  // Integration settings
  enabled: boolean('enabled').notNull().default(true),

  // Webhook configuration
  webhookId: varchar('webhook_id', { length: 100 }),
  webhookSecret: text('webhook_secret'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Sync metadata linking OpenCaptain tasks to Linear issues.
 * Enables bidirectional sync by tracking correlation and timestamps.
 */
export const linearSyncMetadata = pgTable('linear_sync_metadata', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Link to local task
  taskId: uuid('task_id')
    .notNull()
    .unique()
    .references(() => tasks.id, { onDelete: 'cascade' }),

  // Linear issue correlation
  linearIssueId: varchar('linear_issue_id', { length: 100 }).notNull().unique(),
  linearTeamId: varchar('linear_team_id', { length: 100 }).notNull(),
  linearIdentifier: varchar('linear_identifier', { length: 50 }), // e.g., "TEAM-123"

  // Sync tracking
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).defaultNow().notNull(),
  lastSyncDirection: linearSyncDirectionEnum('last_sync_direction').notNull().default('to_linear'),

  // Conflict resolution: store last known timestamps from both systems
  lastLocalUpdatedAt: timestamp('last_local_updated_at', { withTimezone: true }),
  lastLinearUpdatedAt: timestamp('last_linear_updated_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

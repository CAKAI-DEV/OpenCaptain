import { relations } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { squads } from './squads';
import { users } from './users';

/**
 * Check-in question types
 */
export interface CheckInQuestion {
  id: string;
  text: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  options?: string[]; // For select type
  required: boolean;
}

/**
 * Check-in blocks - admin-configured recurring check-in prompts
 */
export const checkInBlocks = pgTable(
  'check_in_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),

    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),

    // Scheduling (cron pattern + timezone)
    cronPattern: varchar('cron_pattern', { length: 50 }).notNull(), // e.g., '0 9 * * 1-5'
    timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),

    // Questions (ordered array stored as JSONB)
    questions: jsonb('questions').$type<CheckInQuestion[]>().notNull(),

    // Template reference (null = custom)
    templateId: varchar('template_id', { length: 50 }), // 'daily_standup', 'output_count', 'weekly_forecast'

    // Targeting: who receives this check-in
    targetType: varchar('target_type', { length: 20 }).notNull().default('all'), // 'all' | 'squad' | 'role'
    targetSquadId: uuid('target_squad_id').references(() => squads.id, { onDelete: 'set null' }),
    targetRole: varchar('target_role', { length: 50 }), // 'admin', 'pm', 'squad_lead', 'member'

    enabled: boolean('enabled').default(true).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('check_in_blocks_project_id_idx').on(table.projectId),
    index('check_in_blocks_enabled_idx').on(table.enabled),
  ]
);

export const checkInBlocksRelations = relations(checkInBlocks, ({ one }) => ({
  project: one(projects, {
    fields: [checkInBlocks.projectId],
    references: [projects.id],
  }),
  createdBy: one(users, {
    fields: [checkInBlocks.createdById],
    references: [users.id],
  }),
  targetSquad: one(squads, {
    fields: [checkInBlocks.targetSquadId],
    references: [squads.id],
  }),
}));

import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { squads } from './squads';
import { users } from './users';

/**
 * Escalation routing step - who to notify at each time interval
 */
export interface EscalationStep {
  delayMinutes: number; // 0 = immediate, 240 = 4 hours, 1440 = 24 hours
  routeType: 'reports_to' | 'role' | 'user';
  routeRole?: string; // For role-based routing: admin, pm, squad_lead
  routeUserId?: string; // For direct user routing
  message?: string; // Optional custom message template
}

/**
 * Escalation trigger types
 */
export type EscalationTriggerType = 'blocker_reported' | 'deadline_risk' | 'output_below_threshold';

/**
 * Escalation blocks - admin-configured escalation rules
 */
export const escalationBlocks = pgTable(
  'escalation_blocks',
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

    // Trigger configuration
    triggerType: varchar('trigger_type', { length: 50 }).notNull(), // blocker_reported, deadline_risk, output_below_threshold

    // Deadline risk configuration (for deadline_risk trigger)
    deadlineWarningDays: integer('deadline_warning_days'), // Days before due date to trigger

    // Output threshold configuration (for output_below_threshold trigger)
    outputThreshold: integer('output_threshold'), // Minimum tasks completed per period
    outputPeriodDays: integer('output_period_days'), // Period in days (e.g., 7 for weekly)

    // Targeting: which users/squads this block applies to
    targetType: varchar('target_type', { length: 20 }).notNull().default('all'), // 'all' | 'squad' | 'role'
    targetSquadId: uuid('target_squad_id').references(() => squads.id, { onDelete: 'set null' }),
    targetRole: varchar('target_role', { length: 50 }), // 'admin', 'pm', 'squad_lead', 'member'

    // Escalation chain - time-windowed routing steps
    escalationSteps: jsonb('escalation_steps').$type<EscalationStep[]>().notNull(),

    enabled: boolean('enabled').default(true).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('escalation_blocks_project_id_idx').on(table.projectId),
    index('escalation_blocks_trigger_type_idx').on(table.triggerType),
    index('escalation_blocks_enabled_idx').on(table.enabled),
  ]
);

export const escalationBlocksRelations = relations(escalationBlocks, ({ one }) => ({
  project: one(projects, {
    fields: [escalationBlocks.projectId],
    references: [projects.id],
  }),
  createdBy: one(users, {
    fields: [escalationBlocks.createdById],
    references: [users.id],
  }),
  targetSquad: one(squads, {
    fields: [escalationBlocks.targetSquadId],
    references: [squads.id],
  }),
}));

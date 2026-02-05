import { pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Polymorphic dependency table for cross-type blocking relationships.
 * Can reference tasks or deliverables as both blocker and blocked items.
 */
export const dependencies = pgTable(
  'dependencies',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Blocker (the item that blocks)
    blockerType: varchar('blocker_type', { length: 20 }).notNull(), // 'task' | 'deliverable'
    blockerId: uuid('blocker_id').notNull(),

    // Blocked (the item that is blocked)
    blockedType: varchar('blocked_type', { length: 20 }).notNull(), // 'task' | 'deliverable'
    blockedId: uuid('blocked_id').notNull(),

    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Prevent duplicate dependencies
    uniqueDependency: unique().on(
      table.blockerType,
      table.blockerId,
      table.blockedType,
      table.blockedId
    ),
  })
);

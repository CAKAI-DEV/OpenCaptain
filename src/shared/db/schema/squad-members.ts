import { relations } from 'drizzle-orm';
import { pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { squads } from './squads';
import { users } from './users';

export const squadMembers = pgTable(
  'squad_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    squadId: uuid('squad_id')
      .notNull()
      .references(() => squads.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueSquadUser: unique().on(table.squadId, table.userId),
  })
);

export const squadMembersRelations = relations(squadMembers, ({ one }) => ({
  squad: one(squads, {
    fields: [squadMembers.squadId],
    references: [squads.id],
  }),
  user: one(users, {
    fields: [squadMembers.userId],
    references: [users.id],
  }),
}));

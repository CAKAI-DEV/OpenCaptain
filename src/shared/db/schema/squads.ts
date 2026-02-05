import { type AnyPgColumn, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const squads = pgTable('squads', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  parentSquadId: uuid('parent_squad_id').references((): AnyPgColumn => squads.id, {
    onDelete: 'cascade',
  }),
  leadUserId: uuid('lead_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

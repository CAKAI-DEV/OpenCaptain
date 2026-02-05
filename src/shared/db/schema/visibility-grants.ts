import { pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { squads } from './squads';
import { users } from './users';

export const visibilityGrants = pgTable(
  'visibility_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    granteeUserId: uuid('grantee_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    squadId: uuid('squad_id')
      .notNull()
      .references(() => squads.id, { onDelete: 'cascade' }),
    grantedById: uuid('granted_by_id').references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // NULL = permanent
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueGrant: unique().on(table.granteeUserId, table.squadId),
  })
);

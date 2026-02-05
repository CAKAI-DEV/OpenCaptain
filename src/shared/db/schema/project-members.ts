import { pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 }).notNull(), // 'admin', 'pm', 'squad_lead', 'member'
    reportsToUserId: uuid('reports_to_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserProject: unique().on(table.projectId, table.userId),
  })
);

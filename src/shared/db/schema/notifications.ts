import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { comments } from './comments';
import { projects } from './projects';
import { users } from './users';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    type: varchar('type', { length: 50 }).notNull(), // 'mention' | 'comment' | 'assignment' | 'status_change' | 'due_soon'

    // Actor who triggered notification (nullable for system notifications)
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),

    // Target item (polymorphic)
    targetType: varchar('target_type', { length: 20 }).notNull(), // 'task' | 'deliverable'
    targetId: uuid('target_id').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Related comment (for mention/comment notifications)
    commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'cascade' }),

    // State
    read: boolean('read').default(false).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_read_idx').on(table.userId, table.read),
    index('notifications_user_created_idx').on(table.userId, table.createdAt),
  ]
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [notifications.projectId],
    references: [projects.id],
  }),
  comment: one(comments, {
    fields: [notifications.commentId],
    references: [comments.id],
  }),
}));

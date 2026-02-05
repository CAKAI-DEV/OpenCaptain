import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Polymorphic target (like dependencies pattern from Phase 4)
    targetType: varchar('target_type', { length: 20 }).notNull(), // 'task' | 'deliverable'
    targetId: uuid('target_id').notNull(),

    // Content
    content: text('content').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Resolved @mentions (user IDs array)
    mentions: jsonb('mentions').$type<string[]>().default([]).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('comments_target_idx').on(table.targetType, table.targetId),
    index('comments_project_id_idx').on(table.projectId),
  ]
);

export const commentsRelations = relations(comments, ({ one }) => ({
  project: one(projects, {
    fields: [comments.projectId],
    references: [projects.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));

import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { checkInBlocks } from './check-in-blocks';
import { users } from './users';

/**
 * Individual question response
 */
export interface QuestionResponse {
  questionId: string;
  value: string | number | boolean | null;
}

/**
 * Check-in responses - user responses to check-in prompts
 */
export const checkInResponses = pgTable(
  'check_in_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    checkInBlockId: uuid('check_in_block_id')
      .notNull()
      .references(() => checkInBlocks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Response status
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'completed' | 'skipped'

    // Responses to questions (JSONB array)
    responses: jsonb('responses').$type<QuestionResponse[]>(),

    // Timestamps
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('check_in_responses_block_id_idx').on(table.checkInBlockId),
    index('check_in_responses_user_id_idx').on(table.userId),
    index('check_in_responses_status_idx').on(table.status),
    index('check_in_responses_sent_at_idx').on(table.sentAt),
  ]
);

export const checkInResponsesRelations = relations(checkInResponses, ({ one }) => ({
  checkInBlock: one(checkInBlocks, {
    fields: [checkInResponses.checkInBlockId],
    references: [checkInBlocks.id],
  }),
  user: one(users, {
    fields: [checkInResponses.userId],
    references: [users.id],
  }),
}));

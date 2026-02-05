import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  /** Primary LLM model preference for this organization */
  llmModel: text('llm_model').default('gpt-4o'),
  /** Fallback LLM model when primary fails */
  llmFallbackModel: text('llm_fallback_model').default('claude-3-5-sonnet'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

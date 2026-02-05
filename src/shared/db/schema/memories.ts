import { index, integer, jsonb, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';

export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(), // 'working', 'episodic', 'semantic'
    scope: text('scope').notNull(), // 'organization', 'project', 'user'
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id'), // Source conversation if applicable
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    importance: integer('importance').default(5), // 1-10 scale for retention priority
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // For working memory TTL
  },
  (table) => [
    index('memories_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    index('memories_org_scope_idx').on(table.organizationId, table.scope),
    index('memories_project_idx').on(table.projectId),
    index('memories_user_idx').on(table.userId),
    index('memories_expires_idx').on(table.expiresAt),
  ]
);

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

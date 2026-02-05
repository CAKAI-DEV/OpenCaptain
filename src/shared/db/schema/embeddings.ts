import { index, jsonb, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';

export const embeddings = pgTable(
  'embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    sourceType: text('source_type').notNull(), // 'document', 'conversation', 'memory'
    sourceId: uuid('source_id').notNull(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    embeddingModel: text('embedding_model').notNull().default('text-embedding-3-small'),
    metadata: jsonb('metadata'), // Additional context (chunk index, etc.)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('embeddings_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    index('embeddings_org_project_idx').on(table.organizationId, table.projectId),
    index('embeddings_source_idx').on(table.sourceType, table.sourceId),
  ]
);

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;

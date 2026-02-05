/**
 * RAG service for document indexing and similarity search.
 *
 * Uses pgvector for vector similarity search and respects visibility rules
 * by requiring visible project IDs for all queries.
 */
import { and, cosineDistance, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '../../shared/db';
import { embeddings } from '../../shared/db/schema';
import { generateEmbedding } from '../llm';
import { chunkDocument } from './rag.chunker';
import type { IndexDocumentInput, SimilarDocument } from './rag.types';

/** Minimum cosine similarity threshold for results (0.7 = 70% similar) */
const SIMILARITY_THRESHOLD = 0.7;

/** Default number of results to return */
const DEFAULT_LIMIT = 5;

/**
 * Indexes a document by chunking it and storing embeddings.
 *
 * Documents are split into chunks, each chunk is embedded, and stored
 * with organization/project visibility metadata.
 *
 * @param input - Document content and metadata
 * @returns Array of inserted embedding IDs
 *
 * @example
 * ```ts
 * const ids = await indexDocument({
 *   content: 'Project documentation...',
 *   sourceType: 'document',
 *   sourceId: documentId,
 *   organizationId: orgId,
 *   projectId: projectId,
 * });
 * ```
 */
export async function indexDocument(input: IndexDocumentInput): Promise<string[]> {
  const chunks = await chunkDocument(input.content, input.sourceType, input.sourceId);
  const insertedIds: string[] = [];

  for (const chunk of chunks) {
    const embeddingResult = await generateEmbedding(chunk.content);

    const result = await db
      .insert(embeddings)
      .values({
        content: chunk.content,
        embedding: embeddingResult.embedding,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        userId: input.userId,
        embeddingModel: embeddingResult.model,
        metadata: { ...input.metadata, ...chunk.metadata },
      })
      .returning({ id: embeddings.id });

    if (result[0]) {
      insertedIds.push(result[0].id);
    }
  }

  return insertedIds;
}

/**
 * Finds documents similar to the query, filtered by visible projects.
 *
 * CRITICAL: Always pass user's visible project IDs to respect visibility rules.
 * Empty visibleProjectIds returns no results - this is intentional for security.
 *
 * @param query - Text to find similar documents for
 * @param visibleProjectIds - Project IDs the user has visibility to
 * @param options - Optional limit and threshold overrides
 * @returns Array of similar documents with similarity scores
 *
 * @example
 * ```ts
 * const similar = await findSimilarDocuments(
 *   'How do I deploy?',
 *   userVisibleProjectIds,
 *   { limit: 10 }
 * );
 * ```
 */
export async function findSimilarDocuments(
  query: string,
  visibleProjectIds: string[],
  options?: { limit?: number; threshold?: number }
): Promise<SimilarDocument[]> {
  // If no visible projects, return empty - security first
  if (visibleProjectIds.length === 0) {
    return [];
  }

  const queryEmbedding = await generateEmbedding(query);
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const threshold = options?.threshold ?? SIMILARITY_THRESHOLD;

  // Similarity = 1 - cosine_distance (higher is more similar)
  const similarity = sql<number>`1 - (${cosineDistance(embeddings.embedding, queryEmbedding.embedding)})`;

  // Pre-filter by project visibility, then sort by similarity
  // Use larger candidate set to avoid post-filter issues (see RESEARCH.md Pitfall 1)
  const results = await db
    .select({
      id: embeddings.id,
      content: embeddings.content,
      sourceType: embeddings.sourceType,
      sourceId: embeddings.sourceId,
      similarity,
      metadata: embeddings.metadata,
    })
    .from(embeddings)
    .where(and(inArray(embeddings.projectId, visibleProjectIds), gt(similarity, threshold)))
    .orderBy(desc(similarity))
    .limit(limit);

  return results.map((row) => ({
    ...row,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  }));
}

/**
 * Finds similar documents across all projects (for org-level queries).
 *
 * Use this for organization-wide searches where visibility is determined
 * at the organization level rather than project level.
 *
 * @param query - Text to find similar documents for
 * @param organizationId - Organization to search within
 * @param options - Optional limit and threshold overrides
 * @returns Array of similar documents with similarity scores
 */
export async function findSimilarDocumentsInOrg(
  query: string,
  organizationId: string,
  options?: { limit?: number; threshold?: number }
): Promise<SimilarDocument[]> {
  const queryEmbedding = await generateEmbedding(query);
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const threshold = options?.threshold ?? SIMILARITY_THRESHOLD;

  const similarity = sql<number>`1 - (${cosineDistance(embeddings.embedding, queryEmbedding.embedding)})`;

  const results = await db
    .select({
      id: embeddings.id,
      content: embeddings.content,
      sourceType: embeddings.sourceType,
      sourceId: embeddings.sourceId,
      similarity,
      metadata: embeddings.metadata,
    })
    .from(embeddings)
    .where(and(eq(embeddings.organizationId, organizationId), gt(similarity, threshold)))
    .orderBy(desc(similarity))
    .limit(limit);

  return results.map((row) => ({
    ...row,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  }));
}

/**
 * Deletes all embeddings for a specific source (document, conversation, etc).
 *
 * Use this when a source is deleted or needs to be re-indexed.
 *
 * @param sourceType - Type of the source ('document', 'conversation', 'memory')
 * @param sourceId - UUID of the source
 * @returns Number of embeddings deleted
 */
export async function deleteEmbeddingsBySource(
  sourceType: string,
  sourceId: string
): Promise<number> {
  const deleted = await db
    .delete(embeddings)
    .where(and(eq(embeddings.sourceType, sourceType), eq(embeddings.sourceId, sourceId)))
    .returning({ id: embeddings.id });

  return deleted.length;
}

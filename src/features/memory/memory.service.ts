import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../shared/db';
import { memories } from '../../shared/db/schema';
import { generateEmbedding } from '../llm';
import {
  MEMORY_CAPACITY,
  type MemoryScope,
  type RetrieveMemoriesInput,
  type StoreMemoryInput,
} from './memory.types';

/**
 * Stores a memory with automatic embedding generation and capacity enforcement.
 *
 * @param input - Memory details including type, scope, and content
 * @returns The ID of the stored memory
 */
export async function storeMemory(input: StoreMemoryInput): Promise<string> {
  // Generate embedding for semantic search
  const embeddingResult = await generateEmbedding(input.content);

  const result = await db
    .insert(memories)
    .values({
      type: input.type,
      scope: input.scope,
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      conversationId: input.conversationId,
      content: input.content,
      embedding: embeddingResult.embedding,
      importance: input.importance ?? 5,
      expiresAt: input.expiresAt,
    })
    .returning({ id: memories.id });

  const inserted = result[0];
  if (!inserted) {
    throw new Error('Failed to insert memory');
  }

  // Enforce capacity limits
  await enforceCapacityLimit(input.scope, input.organizationId, input.projectId, input.userId);

  return inserted.id;
}

/**
 * Enforces capacity limits by removing oldest, lowest-importance memories.
 */
async function enforceCapacityLimit(
  scope: MemoryScope,
  organizationId: string,
  projectId?: string,
  userId?: string
): Promise<void> {
  const capacity = MEMORY_CAPACITY[scope];

  // Build scope filter
  const scopeFilter = and(
    eq(memories.scope, scope),
    eq(memories.organizationId, organizationId),
    projectId ? eq(memories.projectId, projectId) : undefined,
    userId ? eq(memories.userId, userId) : undefined
  );

  // Count current entries
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memories)
    .where(scopeFilter);

  const count = countResult[0]?.count ?? 0;

  if (count > capacity) {
    // Delete oldest entries exceeding capacity (keep by importance, then by date)
    const toDelete = await db
      .select({ id: memories.id })
      .from(memories)
      .where(scopeFilter)
      .orderBy(asc(memories.importance), asc(memories.createdAt))
      .limit(count - capacity);

    if (toDelete.length > 0) {
      await db.delete(memories).where(
        inArray(
          memories.id,
          toDelete.map((m) => m.id)
        )
      );
    }
  }
}

/**
 * Retrieves memories matching the specified criteria.
 *
 * @param input - Filter criteria including organizationId and optional scope filters
 * @returns Array of matching memories, ordered by importance and recency
 */
export async function retrieveMemories(input: RetrieveMemoriesInput) {
  const filters = [eq(memories.organizationId, input.organizationId)];

  if (input.projectId) filters.push(eq(memories.projectId, input.projectId));
  if (input.userId) filters.push(eq(memories.userId, input.userId));
  if (input.types?.length) filters.push(inArray(memories.type, input.types));

  return db
    .select()
    .from(memories)
    .where(and(...filters))
    .orderBy(desc(memories.importance), desc(memories.createdAt))
    .limit(input.limit ?? 20);
}

/**
 * Deletes all expired memories.
 *
 * @returns The number of deleted memories
 */
export async function deleteExpiredMemories(): Promise<number> {
  // Use a subquery to count before deleting
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memories)
    .where(sql`${memories.expiresAt} < NOW()`);

  const count = countResult[0]?.count ?? 0;

  if (count > 0) {
    await db.delete(memories).where(sql`${memories.expiresAt} < NOW()`);
  }

  return count;
}

import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../shared/db';
import { conversationMessages } from '../../shared/db/schema';
import { logger } from '../../shared/lib/logger';
import { getQueueConnection, registerWorker } from '../../shared/lib/queue';
import { chatCompletion } from '../llm';
import { storeMemory } from './memory.service';
import { KEEP_RECENT_MESSAGES } from './memory.types';

type ConsolidationJobData = {
  conversationId: string;
  organizationId: string;
  projectId?: string;
  userId: string;
};

/**
 * Consolidates a conversation by summarizing older messages into semantic memory.
 * Keeps the most recent messages in full while summarizing the rest.
 */
async function consolidateConversation(job: Job<ConsolidationJobData>) {
  const { conversationId, organizationId, projectId, userId } = job.data;

  // Get all messages in conversation
  const messages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.createdAt));

  if (messages.length <= KEEP_RECENT_MESSAGES) {
    logger.info({ conversationId }, 'Not enough messages to consolidate');
    return;
  }

  // Split into messages to summarize and messages to keep
  const toSummarize = messages.slice(0, -KEEP_RECENT_MESSAGES);

  // Generate summary using LLM
  const summaryPrompt = [
    {
      role: 'system' as const,
      content:
        'Summarize this conversation concisely, preserving key facts, decisions, and action items. Focus on information that would be useful in future conversations.',
    },
    ...toSummarize.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })),
  ];

  const summaryResult = await chatCompletion(summaryPrompt);

  // Store summary as semantic memory
  await storeMemory({
    type: 'semantic',
    scope: projectId ? 'project' : 'user',
    organizationId,
    projectId,
    userId,
    conversationId,
    content: summaryResult.content,
    importance: 7, // Summaries are moderately important
  });

  // Delete summarized messages
  const messageIdsToDelete = toSummarize.map((m) => m.id);
  await db.delete(conversationMessages).where(inArray(conversationMessages.id, messageIdsToDelete));

  logger.info(
    {
      conversationId,
      summarized: toSummarize.length,
      kept: messages.length - toSummarize.length,
    },
    'Conversation consolidated'
  );
}

/**
 * Starts the memory consolidation worker.
 * Rate-limited to prevent LLM API overload.
 *
 * @returns The worker instance
 */
export function startMemoryConsolidationWorker() {
  const worker = new Worker<ConsolidationJobData>('memory-consolidation', consolidateConversation, {
    connection: getQueueConnection(),
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 60000, // Max 10 consolidations per minute
    },
  });

  registerWorker(worker);
  logger.info('Memory consolidation worker started');
  return worker;
}

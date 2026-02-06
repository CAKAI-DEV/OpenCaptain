/**
 * Coding agent BullMQ worker.
 *
 * Processes coding fix requests asynchronously.
 * Concurrency limited to 1 to prevent GitHub API rate limiting.
 */
import { Worker } from 'bullmq';
import { logger } from '../../shared/lib/logger';
import { getQueueConnection } from '../../shared/lib/queue/client';
import { registerWorker } from '../../shared/lib/queue/workers';
import { processCodingRequest } from './coding-agent.service';
import type { CodingAgentJobData } from './coding-agent.types';

/**
 * Coding agent worker.
 *
 * Processes fix requests one at a time.
 * Max 3 retries on failure.
 */
export const codingAgentWorker = new Worker<CodingAgentJobData>(
  'coding-agent',
  async (job) => {
    const { requestId } = job.data;

    logger.info({ jobId: job.id, requestId }, 'Processing coding fix request');

    const result = await processCodingRequest(requestId);

    if (!result.success) {
      // Throw to trigger retry
      throw new Error(result.error || 'Unknown error');
    }

    logger.info(
      { jobId: job.id, requestId, prUrl: result.prUrl, prNumber: result.prNumber },
      'Coding fix request completed'
    );

    return result;
  },
  {
    connection: getQueueConnection(),
    concurrency: 1, // One request at a time
    limiter: {
      max: 5,
      duration: 60000, // Max 5 requests per minute to avoid rate limits
    },
  }
);

// Configure retries
codingAgentWorker.on('failed', (job, err) => {
  const attemptsMade = job?.attemptsMade ?? 0;
  const maxAttempts = 3;

  logger.warn(
    { jobId: job?.id, requestId: job?.data?.requestId, error: err.message, attemptsMade },
    `Coding fix job failed (attempt ${attemptsMade}/${maxAttempts})`
  );
});

// Register for graceful shutdown
registerWorker(codingAgentWorker);

logger.info('Coding agent worker started');

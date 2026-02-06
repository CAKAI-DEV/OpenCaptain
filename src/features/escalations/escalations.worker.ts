import { Worker } from 'bullmq';
import { logger } from '../../shared/lib/logger';
import { getQueueConnection } from '../../shared/lib/queue/client';
import { registerWorker } from '../../shared/lib/queue/workers';
import { processEscalationStep } from './escalations.service';
import type { EscalationJobData } from './escalations.types';

/**
 * Escalation worker - processes time-windowed escalation steps
 *
 * This worker handles delayed escalation notifications. When a blocker
 * is reported or a deadline/output trigger fires, escalation steps are
 * scheduled with delays (e.g., immediate, 4hr, 24hr). This worker
 * processes each step when its delay expires.
 */
export const escalationWorker = new Worker<EscalationJobData>(
  'escalations',
  async (job) => {
    const { type, escalationInstanceId } = job.data;
    logger.info({ jobId: job.id, type, escalationInstanceId }, 'Processing escalation job');

    switch (type) {
      case 'process_escalation': {
        if (!escalationInstanceId) {
          logger.warn({ jobId: job.id }, 'Missing escalationInstanceId for process_escalation job');
          return;
        }
        await processEscalationStep(escalationInstanceId);
        break;
      }

      default:
        logger.warn({ jobId: job.id, type }, 'Unknown escalation job type');
    }
  },
  {
    connection: getQueueConnection(),
    concurrency: 10,
  }
);

// Register for graceful shutdown
registerWorker(escalationWorker);

logger.info('Escalation worker started');

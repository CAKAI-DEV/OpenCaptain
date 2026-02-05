import type { Worker } from 'bullmq';
import { logger } from '../logger';

const workers: Worker[] = [];

export function registerWorker(worker: Worker): void {
  workers.push(worker);
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job failed');
  });
  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed');
  });
}

export async function closeAllWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
}

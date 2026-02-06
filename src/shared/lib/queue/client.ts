import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../env';
import { logger } from '../logger';

/**
 * BullMQ requires ioredis, separate from the 'redis' package used elsewhere.
 * Per RESEARCH.md Pitfall 6: Use separate connection for BullMQ.
 */
let connection: IORedis | null = null;

export function getQueueConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });
    connection.on('error', (err) => {
      logger.error({ err }, 'BullMQ Redis connection error');
    });
  }
  return connection;
}

export const memoryConsolidationQueue = new Queue('memory-consolidation', {
  connection: getQueueConnection(),
});

export const embeddingQueue = new Queue('embedding-generation', {
  connection: getQueueConnection(),
});

export const notificationQueue = new Queue('notifications', {
  connection: getQueueConnection(),
});

export const proactiveMessagingQueue = new Queue('proactive-messaging', {
  connection: getQueueConnection(),
});

export const checkInQueue = new Queue('check-ins', {
  connection: getQueueConnection(),
});

export const recapQueue = new Queue('recaps', {
  connection: getQueueConnection(),
});

export async function closeQueueConnections(): Promise<void> {
  await memoryConsolidationQueue.close();
  await embeddingQueue.close();
  await notificationQueue.close();
  await proactiveMessagingQueue.close();
  await checkInQueue.close();
  await recapQueue.close();
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}

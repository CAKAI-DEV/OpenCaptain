/**
 * Coding agent queue configuration.
 */
import { Queue } from 'bullmq';
import { getQueueConnection, notificationQueue } from '../../shared/lib/queue/client';

/**
 * Queue for coding agent jobs.
 */
export const codingAgentQueue = new Queue('coding-agent', {
  connection: getQueueConnection(),
});

/**
 * Notification job data for coding agent.
 */
interface CodingAgentNotification {
  userId: string;
  type: string;
  title: string;
  body: string;
}

/**
 * Queue a notification for a user.
 */
export async function queueNotification(data: CodingAgentNotification): Promise<void> {
  await notificationQueue.add('coding-agent-notification', {
    type: 'escalation', // Use escalation type for direct delivery without storage
    userId: data.userId,
    title: data.title,
    body: data.body,
  });
}

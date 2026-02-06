import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { getQueueConnection } from '../../shared/lib/queue/client';
import { registerWorker } from '../../shared/lib/queue/workers';
// Import from barrel export - per RESEARCH.md Pattern 8
import { sendTelegramMessage } from '../telegram';
import { sendWhatsAppMessage } from '../whatsapp/whatsapp.client';
import { storeNotification } from './notifications.service';
import type { NotificationJobData, StandardNotificationJobData } from './notifications.types';

/**
 * Build notification message based on type
 */
function buildMessage(type: string, actorName: string, targetTitle: string): string {
  switch (type) {
    case 'mention':
      return `${actorName} mentioned you in a comment on "${targetTitle}"`;
    case 'comment':
      return `${actorName} commented on "${targetTitle}"`;
    case 'assignment':
      return `${actorName} assigned you to "${targetTitle}"`;
    case 'status_change':
      return `${actorName} updated the status of "${targetTitle}"`;
    case 'due_soon':
      return `"${targetTitle}" is due soon`;
    default:
      return 'You have a new notification';
  }
}

/**
 * Get actor display name from user ID
 */
async function getActorName(actorId: string | null): Promise<string> {
  if (!actorId) return 'Someone';

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, actorId),
    columns: { email: true },
  });

  // Use email prefix as display name
  return user?.email?.split('@')[0] ?? 'Someone';
}

/**
 * Get target title (task or deliverable)
 */
async function getTargetTitle(
  targetType: 'task' | 'deliverable',
  targetId: string
): Promise<string> {
  if (targetType === 'task') {
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, targetId),
      columns: { title: true },
    });
    return task?.title ?? 'a task';
  }
  const deliverable = await db.query.deliverables.findFirst({
    where: eq(schema.deliverables.id, targetId),
    columns: { title: true },
  });
  return deliverable?.title ?? 'a deliverable';
}

/**
 * Deliver message via user's connected messaging channels
 */
async function deliverMessage(userId: string, message: string): Promise<void> {
  const userMessaging = await db.query.userMessaging.findFirst({
    where: eq(schema.userMessaging.userId, userId),
  });

  // Skip messaging if user hasn't enabled it
  if (!userMessaging?.messagingEnabled) {
    logger.info({ userId }, 'Messaging disabled for user, skipping delivery');
    return;
  }

  // Deliver via Telegram if connected
  if (userMessaging.telegramChatId && userMessaging.telegramVerified) {
    try {
      await sendTelegramMessage(userMessaging.telegramChatId, message);
      logger.info({ userId, platform: 'telegram' }, 'Notification delivered');
    } catch (err) {
      logger.error({ err, userId, platform: 'telegram' }, 'Failed to deliver via Telegram');
    }
  }

  // Deliver via WhatsApp if connected
  if (userMessaging.whatsappPhone && userMessaging.whatsappVerified) {
    try {
      await sendWhatsAppMessage(userMessaging.whatsappPhone, message);
      logger.info({ userId, platform: 'whatsapp' }, 'Notification delivered');
    } catch (err) {
      logger.error({ err, userId, platform: 'whatsapp' }, 'Failed to deliver via WhatsApp');
    }
  }
}

/**
 * Notification worker - stores notification and delivers via messaging channels
 */
export const notificationWorker = new Worker<NotificationJobData>(
  'notifications',
  async (job) => {
    const data = job.data;
    logger.info({ jobId: job.id, type: data.type, userId: data.userId }, 'Processing notification');

    // Handle escalation notifications differently (not stored, only delivered)
    if (data.type === 'escalation') {
      const message = `${data.title}\n\n${data.body}`;
      await deliverMessage(data.userId, message);
      return;
    }

    // Standard notifications are stored and delivered
    const standardData = data as StandardNotificationJobData;

    // 1. Store notification in database
    await storeNotification(standardData);

    // 2. Build and deliver notification message
    const actorName = await getActorName(standardData.actorId);
    const targetTitle = await getTargetTitle(standardData.targetType, standardData.targetId);
    const message = buildMessage(standardData.type, actorName, targetTitle);

    await deliverMessage(standardData.userId, message);
  },
  {
    connection: getQueueConnection(),
    concurrency: 10,
  }
);

// Register worker for graceful shutdown
registerWorker(notificationWorker);

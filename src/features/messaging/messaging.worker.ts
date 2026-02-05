import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { getQueueConnection, proactiveMessagingQueue } from '../../shared/lib/queue/client';
import { registerWorker } from '../../shared/lib/queue/workers';
import { sendTelegramMessage } from '../telegram';
import { sendWhatsAppMessage } from '../whatsapp/whatsapp.client';
import {
  generateDailyCheckin,
  generateOverdueAlert,
  generateWeeklyRecap,
} from './messaging.proactive';

interface ProactiveJobData {
  type: 'daily_checkin' | 'overdue_alert' | 'weekly_recap';
  userId: string;
}

/**
 * Send proactive message to user via their preferred channel(s)
 */
async function deliverMessage(userId: string, message: string): Promise<void> {
  const userMessaging = await db.query.userMessaging.findFirst({
    where: eq(schema.userMessaging.userId, userId),
  });

  if (!userMessaging?.messagingEnabled) {
    logger.info({ userId }, 'Messaging disabled, skipping proactive message');
    return;
  }

  // Deliver via Telegram
  if (userMessaging.telegramChatId && userMessaging.telegramVerified) {
    try {
      await sendTelegramMessage(userMessaging.telegramChatId, message);
      logger.info({ userId, platform: 'telegram' }, 'Proactive message delivered');
    } catch (err) {
      logger.error({ err, userId }, 'Failed to deliver via Telegram');
    }
  }

  // Deliver via WhatsApp
  if (userMessaging.whatsappPhone && userMessaging.whatsappVerified) {
    try {
      await sendWhatsAppMessage(userMessaging.whatsappPhone, message);
      logger.info({ userId, platform: 'whatsapp' }, 'Proactive message delivered');
    } catch (err) {
      logger.error({ err, userId }, 'Failed to deliver via WhatsApp');
    }
  }
}

/**
 * Proactive messaging worker
 */
export const proactiveMessagingWorker = new Worker<ProactiveJobData>(
  'proactive-messaging',
  async (job) => {
    const { type, userId } = job.data;
    logger.info({ jobId: job.id, type, userId }, 'Processing proactive message');

    // Get user's last project context
    const userMessaging = await db.query.userMessaging.findFirst({
      where: eq(schema.userMessaging.userId, userId),
      columns: { lastProjectId: true, dailyCheckinEnabled: true, weeklyRecapEnabled: true },
    });

    const projectId = userMessaging?.lastProjectId ?? null;

    let message: string | null = null;

    switch (type) {
      case 'daily_checkin':
        if (!userMessaging?.dailyCheckinEnabled) {
          logger.info({ userId }, 'Daily check-in disabled, skipping');
          return;
        }
        message = await generateDailyCheckin(userId, projectId);
        break;

      case 'overdue_alert':
        message = await generateOverdueAlert(userId, projectId);
        break;

      case 'weekly_recap':
        if (!userMessaging?.weeklyRecapEnabled) {
          logger.info({ userId }, 'Weekly recap disabled, skipping');
          return;
        }
        message = await generateWeeklyRecap(userId, projectId);
        break;
    }

    if (!message) {
      logger.info({ type, userId }, 'No proactive message to send');
      return;
    }

    await deliverMessage(userId, message);
  },
  {
    connection: getQueueConnection(),
    concurrency: 5,
  }
);

// Register for graceful shutdown
registerWorker(proactiveMessagingWorker);

/**
 * Schedule proactive messages for all enabled users
 * Called by a cron job or app startup
 */
export async function scheduleAllProactiveMessages(): Promise<void> {
  // Get all users with messaging enabled
  const users = await db.query.userMessaging.findMany({
    where: eq(schema.userMessaging.messagingEnabled, true),
    columns: { userId: true, dailyCheckinEnabled: true, weeklyRecapEnabled: true },
  });

  logger.info({ userCount: users.length }, 'Scheduling proactive messages');

  for (const user of users) {
    // Daily check-in (9 AM)
    if (user.dailyCheckinEnabled) {
      await proactiveMessagingQueue.add(
        'daily-checkin',
        { type: 'daily_checkin', userId: user.userId },
        {
          repeat: {
            pattern: '0 9 * * *', // 9 AM daily
          },
          jobId: `daily-checkin-${user.userId}`,
        }
      );
    }

    // Weekly recap (Monday 9 AM)
    if (user.weeklyRecapEnabled) {
      await proactiveMessagingQueue.add(
        'weekly-recap',
        { type: 'weekly_recap', userId: user.userId },
        {
          repeat: {
            pattern: '0 9 * * 1', // 9 AM Monday
          },
          jobId: `weekly-recap-${user.userId}`,
        }
      );
    }
  }
}

/**
 * Queue an immediate overdue alert for a user
 */
export async function queueOverdueAlert(userId: string): Promise<void> {
  await proactiveMessagingQueue.add(
    'overdue-alert',
    { type: 'overdue_alert', userId },
    { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
  );
}

export { proactiveMessagingQueue };

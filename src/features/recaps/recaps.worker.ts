import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { getQueueConnection, recapQueue } from '../../shared/lib/queue/client';
import { registerWorker } from '../../shared/lib/queue/workers';
import { sendTelegramMessage } from '../telegram';
import { sendWhatsAppMessage } from '../whatsapp/whatsapp.client';
import { generateRecap } from './recaps.service';
import type { RecapJobData, RecapPeriod } from './recaps.types';

/**
 * Deliver recap message to user
 */
async function deliverRecapMessage(userId: string, message: string): Promise<boolean> {
  const userMessaging = await db.query.userMessaging.findFirst({
    where: eq(schema.userMessaging.userId, userId),
  });

  if (!userMessaging?.messagingEnabled) {
    logger.info({ userId }, 'Messaging disabled, skipping recap delivery');
    return false;
  }

  // Check preference based on period (encoded in message)
  const isWeekly = message.includes('Weekly');
  if (isWeekly && !userMessaging.weeklyRecapEnabled) {
    logger.info({ userId }, 'Weekly recap disabled, skipping');
    return false;
  }
  if (!isWeekly && !userMessaging.dailyCheckinEnabled) {
    // Use dailyCheckinEnabled for daily recaps too
    logger.info({ userId }, 'Daily recap disabled, skipping');
    return false;
  }

  let delivered = false;

  // Deliver via Telegram
  if (userMessaging.telegramChatId && userMessaging.telegramVerified) {
    try {
      await sendTelegramMessage(userMessaging.telegramChatId, message);
      logger.info({ userId, platform: 'telegram' }, 'Recap delivered');
      delivered = true;
    } catch (err) {
      logger.error({ err, userId }, 'Failed to deliver recap via Telegram');
    }
  }

  // Deliver via WhatsApp
  if (userMessaging.whatsappPhone && userMessaging.whatsappVerified) {
    try {
      await sendWhatsAppMessage(userMessaging.whatsappPhone, message);
      logger.info({ userId, platform: 'whatsapp' }, 'Recap delivered');
      delivered = true;
    } catch (err) {
      logger.error({ err, userId }, 'Failed to deliver recap via WhatsApp');
    }
  }

  return delivered;
}

/**
 * Recap worker - generates and delivers scheduled recaps
 */
export const recapWorker = new Worker<RecapJobData>(
  'recaps',
  async (job) => {
    const { userId, projectId, organizationId, period } = job.data;
    logger.info({ jobId: job.id, userId, projectId, period }, 'Processing recap job');

    try {
      // Generate role-appropriate recap
      const recap = await generateRecap(userId, projectId, organizationId, period);

      // Deliver to user
      await deliverRecapMessage(userId, recap);
    } catch (err) {
      logger.error({ err, userId, projectId }, 'Failed to generate/deliver recap');
      throw err; // Allow retry
    }
  },
  {
    connection: getQueueConnection(),
    concurrency: 5,
  }
);

// Register for graceful shutdown
registerWorker(recapWorker);

/**
 * Schedule recaps for all users in a project
 */
export async function scheduleProjectRecaps(
  projectId: string,
  organizationId: string,
  period: RecapPeriod
): Promise<void> {
  // Get project members with messaging enabled
  const members = await db.query.projectMembers.findMany({
    where: eq(schema.projectMembers.projectId, projectId),
    columns: { userId: true },
  });

  const messagingPrefs = await db.query.userMessaging.findMany({
    where: eq(schema.userMessaging.messagingEnabled, true),
  });
  const enabledUserIds = new Set(messagingPrefs.map((p) => p.userId));

  const eligibleMembers = members.filter((m) => enabledUserIds.has(m.userId));

  logger.info({ projectId, period, count: eligibleMembers.length }, 'Scheduling recaps');

  for (const member of eligibleMembers) {
    await queueRecap(member.userId, projectId, organizationId, period);
  }
}

/**
 * Queue a single recap for delivery
 */
export async function queueRecap(
  userId: string,
  projectId: string,
  organizationId: string,
  period: RecapPeriod
): Promise<void> {
  await recapQueue.add(
    `recap-${userId}-${projectId}-${period}`,
    {
      type: 'generate_recap',
      userId,
      projectId,
      organizationId,
      period,
    },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    }
  );
}

/**
 * Schedule recurring recaps for a project
 */
export async function scheduleRecurringRecaps(
  projectId: string,
  organizationId: string
): Promise<void> {
  const members = await db.query.projectMembers.findMany({
    where: eq(schema.projectMembers.projectId, projectId),
    columns: { userId: true },
  });

  for (const member of members) {
    // Daily recap at 6 PM
    await recapQueue.add(
      `daily-recap-${member.userId}-${projectId}`,
      {
        type: 'generate_recap',
        userId: member.userId,
        projectId,
        organizationId,
        period: 'daily' as RecapPeriod,
      },
      {
        repeat: { pattern: '0 18 * * *' }, // 6 PM daily
        jobId: `daily-recap-${member.userId}-${projectId}`,
      }
    );

    // Weekly recap on Friday 5 PM
    await recapQueue.add(
      `weekly-recap-${member.userId}-${projectId}`,
      {
        type: 'generate_recap',
        userId: member.userId,
        projectId,
        organizationId,
        period: 'weekly' as RecapPeriod,
      },
      {
        repeat: { pattern: '0 17 * * 5' }, // 5 PM Friday
        jobId: `weekly-recap-${member.userId}-${projectId}`,
      }
    );
  }

  logger.info({ projectId, members: members.length }, 'Scheduled recurring recaps');
}

export { recapQueue };

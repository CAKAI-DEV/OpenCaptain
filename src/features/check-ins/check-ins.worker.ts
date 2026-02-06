import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { getQueueConnection } from '../../shared/lib/queue/client';
import { registerWorker } from '../../shared/lib/queue/workers';
import { sendTelegramMessage } from '../telegram';
import { sendWhatsAppMessage } from '../whatsapp/whatsapp.client';
import { formatCheckInPrompt, recordCheckInSent } from './check-ins.service';
import type { CheckInJobData } from './check-ins.types';

/**
 * Deliver check-in message to user via their preferred channels
 */
async function deliverCheckInMessage(userId: string, message: string): Promise<boolean> {
  const userMessaging = await db.query.userMessaging.findFirst({
    where: eq(schema.userMessaging.userId, userId),
  });

  if (!userMessaging?.messagingEnabled) {
    logger.info({ userId }, 'Messaging disabled, skipping check-in delivery');
    return false;
  }

  let delivered = false;

  // Deliver via Telegram
  if (userMessaging.telegramChatId && userMessaging.telegramVerified) {
    try {
      await sendTelegramMessage(userMessaging.telegramChatId, message);
      logger.info({ userId, platform: 'telegram' }, 'Check-in delivered');
      delivered = true;
    } catch (err) {
      logger.error({ err, userId }, 'Failed to deliver check-in via Telegram');
    }
  }

  // Deliver via WhatsApp
  if (userMessaging.whatsappPhone && userMessaging.whatsappVerified) {
    try {
      await sendWhatsAppMessage(userMessaging.whatsappPhone, message);
      logger.info({ userId, platform: 'whatsapp' }, 'Check-in delivered');
      delivered = true;
    } catch (err) {
      logger.error({ err, userId }, 'Failed to deliver check-in via WhatsApp');
    }
  }

  return delivered;
}

/**
 * Check-in worker - sends scheduled check-in prompts
 */
export const checkInWorker = new Worker<CheckInJobData>(
  'check-ins',
  async (job) => {
    const { checkInBlockId, userId } = job.data;
    logger.info({ jobId: job.id, checkInBlockId, userId }, 'Processing check-in job');

    // Get check-in block configuration
    const block = await db.query.checkInBlocks.findFirst({
      where: eq(schema.checkInBlocks.id, checkInBlockId),
    });

    if (!block) {
      logger.warn({ checkInBlockId }, 'Check-in block not found, skipping');
      return;
    }

    if (!block.enabled) {
      logger.info({ checkInBlockId }, 'Check-in block disabled, skipping');
      return;
    }

    // Format check-in message
    const message = formatCheckInPrompt(block.name, block.questions);

    // Deliver to user
    const delivered = await deliverCheckInMessage(userId, message);

    if (delivered) {
      // Record that check-in was sent
      await recordCheckInSent(checkInBlockId, userId);
    }
  },
  {
    connection: getQueueConnection(),
    concurrency: 10,
  }
);

// Register for graceful shutdown
registerWorker(checkInWorker);

import { eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { getPendingTaskConfirmation } from '../../shared/lib/redis';
import { type PendingTaskConfirmation, processMessage } from '../messaging';
import { sendWhatsAppInteractiveMessage, sendWhatsAppMessage } from './whatsapp.client';
import type { IncomingMessage } from './whatsapp.types';

/**
 * Get user ID from WhatsApp phone number
 */
export async function getUserIdFromWhatsApp(phone: string): Promise<string | null> {
  const record = await db.query.userMessaging.findFirst({
    where: eq(schema.userMessaging.whatsappPhone, phone),
    columns: { userId: true },
  });
  return record?.userId ?? null;
}

/**
 * Connect WhatsApp account to user
 */
export async function connectWhatsAppAccount(
  phone: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .insert(schema.userMessaging)
      .values({
        userId,
        whatsappPhone: phone,
        whatsappVerified: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.userMessaging.userId,
        set: {
          whatsappPhone: phone,
          whatsappVerified: true,
          updatedAt: new Date(),
        },
      });
    return { success: true };
  } catch (err) {
    logger.error({ err, phone, userId }, 'Failed to connect WhatsApp account');
    return { success: false, error: 'Database error' };
  }
}

/**
 * Handle incoming WhatsApp message
 */
export async function handleIncomingMessage(message: IncomingMessage): Promise<void> {
  logger.info({ messageId: message.messageId, from: message.from }, 'Processing WhatsApp message');

  const userId = await getUserIdFromWhatsApp(message.from);

  if (!userId) {
    // User not linked - send instructions
    await sendWhatsAppMessage(
      message.from,
      'Welcome to OpenCaptain! To connect your account, please use the web app and click "Connect WhatsApp".'
    );
    return;
  }

  // Process message through NLU pipeline
  const result = await processMessage(userId, message.text, 'whatsapp');

  // Check if we have a pending task confirmation
  const pendingResult = await getPendingTaskConfirmation<PendingTaskConfirmation>(userId);

  if (pendingResult.success && pendingResult.data) {
    // Send interactive message with buttons for task confirmation
    await sendWhatsAppInteractiveMessage(message.from, result.response, [
      { id: 'task_confirm', title: 'Confirm' },
      { id: 'task_cancel', title: 'Cancel' },
    ]);
  } else {
    await sendWhatsAppMessage(message.from, result.response);
  }
}

/**
 * Handle WhatsApp interactive button response
 */
export async function handleButtonResponse(phone: string, buttonId: string): Promise<void> {
  logger.info({ phone, buttonId }, 'Processing WhatsApp button response');

  const userId = await getUserIdFromWhatsApp(phone);
  if (!userId) {
    return;
  }

  let responseText: string;

  switch (buttonId) {
    case 'task_confirm': {
      const result = await processMessage(userId, 'yes', 'whatsapp');
      responseText = result.response;
      break;
    }
    case 'task_cancel': {
      const result = await processMessage(userId, 'no', 'whatsapp');
      responseText = result.response;
      break;
    }
    default:
      responseText = 'Unknown action. Please try again.';
  }

  await sendWhatsAppMessage(phone, responseText);
}

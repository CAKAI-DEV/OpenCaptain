import { eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { processMessage } from '../messaging';
import { sendWhatsAppMessage } from './whatsapp.client';
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
      'Welcome to BlockBot! To connect your account, please use the web app and click "Connect WhatsApp".'
    );
    return;
  }

  // Process message through NLU pipeline
  const result = await processMessage(userId, message.text, 'whatsapp');
  await sendWhatsAppMessage(message.from, result.response);
}

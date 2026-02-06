import Client, { MessageType } from '@great-detail/whatsapp';
import { env } from '../../shared/lib/env';
import { logger } from '../../shared/lib/logger';

let client: Client | null = null;

export function isWhatsAppConfigured(): boolean {
  return !!(
    env.WHATSAPP_ACCESS_TOKEN &&
    env.WHATSAPP_PHONE_NUMBER_ID &&
    env.WHATSAPP_VERIFY_TOKEN &&
    env.WHATSAPP_APP_SECRET
  );
}

export function getWhatsAppClient(): Client | null {
  if (!isWhatsAppConfigured()) {
    logger.warn('WhatsApp not configured - missing environment variables');
    return null;
  }

  if (!client) {
    client = new Client({
      request: {
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        },
      },
    });
  }

  return client;
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  const wa = getWhatsAppClient();
  if (!wa || !env.WHATSAPP_PHONE_NUMBER_ID) return false;

  try {
    await wa.message.createMessage({
      phoneNumberID: env.WHATSAPP_PHONE_NUMBER_ID,
      to,
      type: MessageType.Text,
      [MessageType.Text]: { body: text },
    });
    return true;
  } catch (err) {
    logger.error({ err, to }, 'Failed to send WhatsApp message');
    return false;
  }
}

/**
 * Send WhatsApp interactive message with buttons
 */
export async function sendWhatsAppInteractiveMessage(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<boolean> {
  const wa = getWhatsAppClient();
  if (!wa || !env.WHATSAPP_PHONE_NUMBER_ID) return false;

  try {
    await wa.message.createMessage({
      phoneNumberID: env.WHATSAPP_PHONE_NUMBER_ID,
      to,
      type: MessageType.Interactive,
      [MessageType.Interactive]: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map((btn) => ({
            type: 'reply' as const,
            reply: {
              id: btn.id,
              title: btn.title.slice(0, 20), // WhatsApp button title limit
            },
          })),
        },
      },
    });
    return true;
  } catch (err) {
    logger.error({ err, to }, 'Failed to send WhatsApp interactive message');
    return false;
  }
}

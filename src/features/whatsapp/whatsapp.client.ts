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
  if (!wa) return false;

  try {
    await wa.message.createMessage({
      phoneNumberID: env.WHATSAPP_PHONE_NUMBER_ID!,
      to,
      type: MessageType.Text,
      text: { body: text },
    });
    return true;
  } catch (err) {
    logger.error({ err, to }, 'Failed to send WhatsApp message');
    return false;
  }
}

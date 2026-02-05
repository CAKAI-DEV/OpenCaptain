import crypto from 'crypto';
import { Hono } from 'hono';
import { env } from '../../shared/lib/env';
import { logger } from '../../shared/lib/logger';
import { isWhatsAppConfigured } from './whatsapp.client';
import { handleIncomingMessage } from './whatsapp.handlers';
import type { WebhookPayload } from './whatsapp.types';

const app = new Hono();

/**
 * Verify webhook signature from Meta
 */
function verifySignature(body: string, signature: string | undefined): boolean {
  if (!signature || !env.WHATSAPP_APP_SECRET) return false;

  const expectedSig = crypto
    .createHmac('sha256', env.WHATSAPP_APP_SECRET)
    .update(body)
    .digest('hex');

  return signature === `sha256=${expectedSig}`;
}

// Webhook verification (GET) - Meta sends this to verify endpoint
app.get('/webhook/whatsapp', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (!isWhatsAppConfigured()) {
    return c.text('WhatsApp not configured', 503);
  }

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified');
    return c.text(challenge ?? '');
  }

  logger.warn({ mode, token }, 'WhatsApp webhook verification failed');
  return c.text('Forbidden', 403);
});

// Webhook events (POST) - Meta sends message events here
app.post('/webhook/whatsapp', async (c) => {
  if (!isWhatsAppConfigured()) {
    return c.json({ error: 'WhatsApp not configured' }, 503);
  }

  const body = await c.req.text();
  const signature = c.req.header('x-hub-signature-256');

  // Verify signature
  if (!verifySignature(body, signature)) {
    logger.warn('WhatsApp webhook signature verification failed');
    return c.text('Invalid signature', 401);
  }

  // Parse and process messages
  try {
    const payload: WebhookPayload = JSON.parse(body);

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === 'messages' && change.value.messages) {
          for (const message of change.value.messages) {
            if (message.type === 'text' && message.text?.body) {
              await handleIncomingMessage({
                messageId: message.id,
                from: message.from,
                text: message.text.body,
                timestamp: new Date(Number(message.timestamp) * 1000),
              });
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Failed to process WhatsApp webhook');
  }

  // Always return 200 to acknowledge receipt (Meta requirement)
  return c.text('OK');
});

export default app;

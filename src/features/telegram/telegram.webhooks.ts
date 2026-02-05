import { webhookCallback } from 'grammy';
import { Hono } from 'hono';
import { logger } from '../../shared/lib/logger';
import { createTelegramBot, getTelegramBot, isTelegramConfigured } from './telegram.bot';
import { registerHandlers } from './telegram.handlers';

const app = new Hono();

// Initialize bot only if configured
if (isTelegramConfigured()) {
  const bot = createTelegramBot();
  if (bot) {
    registerHandlers(bot);
    logger.info('Telegram bot initialized');
  }
}

// Webhook endpoint
app.post('/webhook/telegram', async (c) => {
  const bot = getTelegramBot();
  if (!bot) {
    return c.json({ error: 'Telegram not configured' }, 503);
  }

  return webhookCallback(bot, 'hono')(c);
});

// Health check for webhook status
app.get('/webhook/telegram', (c) => {
  return c.json({
    configured: isTelegramConfigured(),
    status: getTelegramBot() ? 'active' : 'disabled',
  });
});

export default app;

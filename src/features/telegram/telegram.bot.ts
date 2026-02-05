import { RedisAdapter } from '@grammyjs/storage-redis';
import { Bot, session } from 'grammy';
import { env } from '../../shared/lib/env';
import { logger } from '../../shared/lib/logger';
import { getQueueConnection } from '../../shared/lib/queue/client';
import type { BotContext, SessionData } from './telegram.types';

let botInstance: Bot<BotContext> | null = null;

/**
 * Check if Telegram bot is configured
 */
export function isTelegramConfigured(): boolean {
  return !!env.TELEGRAM_BOT_TOKEN;
}

/**
 * Create and configure the Telegram bot with Redis session storage
 */
export function createTelegramBot(): Bot<BotContext> | null {
  if (!isTelegramConfigured()) {
    logger.warn('TELEGRAM_BOT_TOKEN not configured, Telegram bot disabled');
    return null;
  }

  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN as string);

  // Configure session with Redis storage
  bot.use(
    session({
      initial: (): SessionData => ({
        currentProjectId: null,
        conversationId: null,
        lastActivity: Date.now(),
      }),
      storage: new RedisAdapter<SessionData>({
        instance: getQueueConnection(),
      }),
      getSessionKey: (ctx) => ctx.from?.id.toString(),
    })
  );

  botInstance = bot;
  return bot;
}

/**
 * Get the current bot instance
 */
export function getTelegramBot(): Bot<BotContext> | null {
  return botInstance;
}

/**
 * Send a message to a Telegram chat
 * Used by notification and proactive messaging workers
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const bot = getTelegramBot();
  if (!bot) {
    throw new Error('Telegram bot not configured');
  }
  await bot.api.sendMessage(chatId, text);
}

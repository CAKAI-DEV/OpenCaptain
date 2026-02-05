import { eq } from 'drizzle-orm';
import type { Bot, InlineKeyboard } from 'grammy';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { processMessage } from '../messaging';
import type { BotContext } from './telegram.types';

/**
 * Look up userId from Telegram chat ID
 */
export async function getUserIdFromTelegram(telegramChatId: string): Promise<string | null> {
  const messaging = await db.query.userMessaging.findFirst({
    where: eq(schema.userMessaging.telegramChatId, telegramChatId),
  });
  return messaging?.userId ?? null;
}

/**
 * Connect a Telegram account to a BlockBot user
 */
export async function connectTelegramAccount(
  telegramChatId: string,
  userId: string,
  telegramUsername?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if this Telegram account is already linked to another user
    const existingLink = await db.query.userMessaging.findFirst({
      where: eq(schema.userMessaging.telegramChatId, telegramChatId),
    });

    if (existingLink && existingLink.userId !== userId) {
      return {
        success: false,
        error: 'This Telegram account is already linked to another user',
      };
    }

    // Upsert user_messaging record
    await db
      .insert(schema.userMessaging)
      .values({
        userId,
        telegramChatId,
        telegramUsername,
        telegramVerified: true,
        messagingEnabled: true,
      })
      .onConflictDoUpdate({
        target: [schema.userMessaging.userId],
        set: {
          telegramChatId,
          telegramUsername,
          telegramVerified: true,
          updatedAt: new Date(),
        },
      });

    logger.info({ userId, telegramChatId }, 'Telegram account connected');
    return { success: true };
  } catch (err) {
    logger.error({ err, userId, telegramChatId }, 'Failed to connect Telegram account');
    return { success: false, error: 'Failed to connect account' };
  }
}

/**
 * Get user's visible projects
 */
async function getUserProjects(userId: string) {
  // Get project memberships
  const memberships = await db.query.projectMembers.findMany({
    where: eq(schema.projectMembers.userId, userId),
  });

  if (memberships.length === 0) {
    return [];
  }

  // Get project details
  const projects = [];
  for (const membership of memberships) {
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, membership.projectId),
    });
    if (project) {
      projects.push(project);
    }
  }

  return projects;
}

/**
 * Register all command handlers on the bot
 */
export function registerHandlers(bot: Bot<BotContext>): void {
  // /start command - handles deep links for account connection
  bot.command('start', async (ctx) => {
    const param = ctx.match;
    const chatId = ctx.chat?.id.toString();

    if (!chatId) {
      await ctx.reply('Could not determine chat ID.');
      return;
    }

    // Check for deep link param starting with "connect_"
    if (param && param.startsWith('connect_')) {
      const userId = param.substring(8); // Remove "connect_" prefix

      const result = await connectTelegramAccount(chatId, userId, ctx.from?.username);

      if (result.success) {
        await ctx.reply(
          'Your Telegram account has been connected to BlockBot!\n\n' +
            'You can now receive notifications and interact with your projects.\n\n' +
            'Use /help to see available commands.'
        );
      } else {
        await ctx.reply(
          `Failed to connect account: ${result.error}\n\n` +
            'Please try generating a new link from the BlockBot web app.'
        );
      }
      return;
    }

    // No deep link param - show welcome message
    const existingUser = await getUserIdFromTelegram(chatId);

    if (existingUser) {
      await ctx.reply(
        'Welcome back to BlockBot!\n\n' +
          'Your account is already connected.\n\n' +
          'Commands:\n' +
          '/switch - Switch between projects\n' +
          '/help - Show available commands'
      );
    } else {
      await ctx.reply(
        'Welcome to BlockBot!\n\n' +
          'To connect your account, please:\n' +
          '1. Log in to BlockBot web app\n' +
          '2. Go to Settings > Messaging\n' +
          '3. Click "Connect Telegram"\n' +
          '4. Follow the link back to this bot\n\n' +
          'Once connected, you can receive notifications and manage your projects here.'
      );
    }
  });

  // /switch command - switch between projects
  bot.command('switch', async (ctx) => {
    const chatId = ctx.chat?.id.toString();

    if (!chatId) {
      await ctx.reply('Could not determine chat ID.');
      return;
    }

    const userId = await getUserIdFromTelegram(chatId);

    if (!userId) {
      await ctx.reply(
        'Your account is not connected.\n\n' +
          'Please connect your account first using the BlockBot web app.\n' +
          'Use /start for instructions.'
      );
      return;
    }

    const projects = await getUserProjects(userId);

    if (projects.length === 0) {
      await ctx.reply(
        "You don't have access to any projects yet.\n\n" +
          'Ask your team admin to invite you to a project.'
      );
      return;
    }

    // Build inline keyboard with project names
    const { InlineKeyboard } = await import('grammy');
    const keyboard = new InlineKeyboard();

    for (const project of projects) {
      keyboard.text(project.name, `switch:${project.id}`).row();
    }

    await ctx.reply('Select a project to switch to:', {
      reply_markup: keyboard,
    });
  });

  // Handle callback queries for project selection
  bot.callbackQuery(/^switch:(.+)$/, async (ctx) => {
    const projectId = ctx.match[1];
    const chatId = ctx.chat?.id.toString();

    if (!chatId || !projectId) {
      await ctx.answerCallbackQuery({ text: 'Error: Could not determine chat' });
      return;
    }

    const userId = await getUserIdFromTelegram(chatId);

    if (!userId) {
      await ctx.answerCallbackQuery({ text: 'Account not connected' });
      return;
    }

    // Verify user has access to this project
    const projects = await getUserProjects(userId);
    const project = projects.find((p) => p.id === projectId);

    if (!project) {
      await ctx.answerCallbackQuery({ text: 'Project not found or no access' });
      return;
    }

    // Update session
    ctx.session.currentProjectId = projectId;
    ctx.session.lastActivity = Date.now();

    // Update user_messaging.lastProjectId
    await db
      .update(schema.userMessaging)
      .set({ lastProjectId: projectId, updatedAt: new Date() })
      .where(eq(schema.userMessaging.userId, userId));

    await ctx.answerCallbackQuery({ text: `Switched to ${project.name}` });
    await ctx.editMessageText(`Current project: ${project.name}`);
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'BlockBot Commands:\n\n' +
        '/start - Connect your account or show welcome\n' +
        '/switch - Switch between your projects\n' +
        '/help - Show this help message\n\n' +
        'You can also send messages directly and I will help you manage your tasks and projects.\n\n' +
        'Examples:\n' +
        '- "What are my tasks for today?"\n' +
        '- "Create a new task: Review PRs"\n' +
        '- "Show project status"'
    );
  });

  // Handle text messages
  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat?.id.toString();

    if (!chatId) {
      return;
    }

    const userId = await getUserIdFromTelegram(chatId);

    if (!userId) {
      await ctx.reply(
        'Your account is not connected.\n\n' +
          'Please connect your account first to use natural language features.\n' +
          'Use /start for instructions.'
      );
      return;
    }

    // Update last activity
    ctx.session.lastActivity = Date.now();

    // Process message through NLU pipeline
    const result = await processMessage(userId, ctx.message.text, 'telegram');
    await ctx.reply(result.response);

    // Update session if project changed
    if (result.newProjectId) {
      ctx.session.currentProjectId = result.newProjectId;
    }
  });

  logger.info('Telegram command handlers registered');
}

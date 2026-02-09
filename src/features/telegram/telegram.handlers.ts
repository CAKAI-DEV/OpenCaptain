import { eq } from 'drizzle-orm';
import type { Bot } from 'grammy';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { getPendingTaskConfirmation } from '../../shared/lib/redis';
import { type PendingTaskConfirmation, processMessage } from '../messaging';
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
 * Connect a Telegram account to a OpenCaptain user
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
    if (param?.startsWith('connect_')) {
      const userId = param.substring(8); // Remove "connect_" prefix

      const result = await connectTelegramAccount(chatId, userId, ctx.from?.username);

      if (result.success) {
        await ctx.reply(
          'Your Telegram account has been connected to OpenCaptain!\n\n' +
            'You can now receive notifications and interact with your projects.\n\n' +
            'Use /help to see available commands.'
        );
      } else {
        await ctx.reply(
          `Failed to connect account: ${result.error}\n\n` +
            'Please try generating a new link from the OpenCaptain web app.'
        );
      }
      return;
    }

    // No deep link param - show welcome message
    const existingUser = await getUserIdFromTelegram(chatId);

    if (existingUser) {
      await ctx.reply(
        'Welcome back to OpenCaptain!\n\n' +
          'Your account is already connected.\n\n' +
          'Commands:\n' +
          '/switch - Switch between projects\n' +
          '/help - Show available commands'
      );
    } else {
      await ctx.reply(
        'Welcome to OpenCaptain!\n\n' +
          'To connect your account, please:\n' +
          '1. Log in to OpenCaptain web app\n' +
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
          'Please connect your account first using the OpenCaptain web app.\n' +
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

  // /task command - quick task creation
  bot.command('task', async (ctx) => {
    const chatId = ctx.chat?.id.toString();
    const taskDescription = ctx.match?.trim();

    if (!chatId) {
      await ctx.reply('Could not determine chat ID.');
      return;
    }

    const userId = await getUserIdFromTelegram(chatId);

    if (!userId) {
      await ctx.reply(
        'Your account is not connected.\n\n' +
          'Please connect your account first using the OpenCaptain web app.\n' +
          'Use /start for instructions.'
      );
      return;
    }

    if (!taskDescription) {
      await ctx.reply(
        'Usage: /task [description]\n\n' +
          'Examples:\n' +
          '/task Review the PR for login feature\n' +
          '/task Fix the bug in payment processing by Friday\n' +
          '/task Update documentation high priority\n\n' +
          'Or simply type "Create a task to [description]"'
      );
      return;
    }

    // Process the task creation through NLU pipeline
    const result = await processMessage(userId, `Create a task: ${taskDescription}`, 'telegram');

    // Check if we have a pending confirmation (task was extracted)
    const pendingResult = await getPendingTaskConfirmation<PendingTaskConfirmation>(userId);

    if (pendingResult.success && pendingResult.data) {
      // Add inline keyboard for confirmation
      const { InlineKeyboard } = await import('grammy');
      const keyboard = new InlineKeyboard()
        .text('Confirm', 'task_confirm')
        .text('Cancel', 'task_cancel')
        .row()
        .text('Edit', 'task_edit');

      await ctx.reply(result.response, {
        reply_markup: keyboard,
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(result.response);
    }
  });

  // Handle task confirmation callback
  bot.callbackQuery('task_confirm', async (ctx) => {
    const chatId = ctx.chat?.id.toString();

    if (!chatId) {
      await ctx.answerCallbackQuery({ text: 'Error' });
      return;
    }

    const userId = await getUserIdFromTelegram(chatId);
    if (!userId) {
      await ctx.answerCallbackQuery({ text: 'Account not connected' });
      return;
    }

    // Process confirmation
    const result = await processMessage(userId, 'yes', 'telegram');
    await ctx.answerCallbackQuery({ text: 'Task created!' });
    await ctx.editMessageText(result.response);
  });

  // Handle task cancel callback
  bot.callbackQuery('task_cancel', async (ctx) => {
    const chatId = ctx.chat?.id.toString();

    if (!chatId) {
      await ctx.answerCallbackQuery({ text: 'Error' });
      return;
    }

    const userId = await getUserIdFromTelegram(chatId);
    if (!userId) {
      await ctx.answerCallbackQuery({ text: 'Account not connected' });
      return;
    }

    // Process cancellation
    const result = await processMessage(userId, 'no', 'telegram');
    await ctx.answerCallbackQuery({ text: 'Cancelled' });
    await ctx.editMessageText(result.response);
  });

  // Handle task edit callback
  bot.callbackQuery('task_edit', async (ctx) => {
    const chatId = ctx.chat?.id.toString();

    if (!chatId) {
      await ctx.answerCallbackQuery({ text: 'Error' });
      return;
    }

    const userId = await getUserIdFromTelegram(chatId);
    if (!userId) {
      await ctx.answerCallbackQuery({ text: 'Account not connected' });
      return;
    }

    // Show edit instructions
    const pending = await getPendingTaskConfirmation<PendingTaskConfirmation>(userId);
    if (pending.success && pending.data) {
      await ctx.answerCallbackQuery({ text: 'Send your changes' });
      await ctx.reply(
        'Current task details:\n\n' +
          `*Title:* ${pending.data.extractedTask.title || 'Not set'}\n` +
          `*Priority:* ${pending.data.extractedTask.priority || 'medium'}\n` +
          `*Due:* ${pending.data.extractedTask.dueDate || 'Not set'}\n\n` +
          'Reply with what you want to change, for example:\n' +
          '"Change the title to Review login PR"\n' +
          '"Make it high priority"\n' +
          '"Due tomorrow"',
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.answerCallbackQuery({ text: 'No pending task' });
    }
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'OpenCaptain Commands:\n\n' +
        '/start - Connect your account or show welcome\n' +
        '/switch - Switch between your projects\n' +
        '/task [description] - Quick task creation\n' +
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

/**
 * Unified message processing service for messaging channels.
 *
 * Processes natural language messages from Telegram and WhatsApp,
 * routing to appropriate handlers based on detected intent.
 */
import { and, eq, gte, lte, ne } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { sendMessage as conversationSendMessage, createConversation } from '../conversations';
import { reportBlocker } from '../escalations';
import { getAvailableProjects, getUserContext, switchProject } from './messaging.context';
import { detectIntent } from './messaging.intents';
import type { IntentResult, MessageContext, ProcessedMessage } from './messaging.types';

/**
 * Get tasks due within a time range for a user.
 */
async function getTasksForTimeRange(
  userId: string,
  projectId: string | null,
  timeRange: string
): Promise<Array<{ id: string; title: string; dueDate: Date | null; status: string }>> {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (timeRange) {
    case 'today': {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    }
    case 'this_week': {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    case 'this_month': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'overdue': {
      startDate = new Date(0); // Beginning of time
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    }
    default: {
      // Default to next 7 days
      startDate = new Date(now);
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 7);
    }
  }

  // Build conditions
  const conditions = [
    eq(schema.tasks.assigneeId, userId),
    gte(schema.tasks.dueDate, startDate),
    lte(schema.tasks.dueDate, endDate),
  ];

  if (projectId) {
    conditions.push(eq(schema.tasks.projectId, projectId));
  }

  // Exclude completed tasks for non-overdue queries
  if (timeRange !== 'overdue') {
    conditions.push(ne(schema.tasks.status, 'done'));
  }

  const tasks = await db.query.tasks.findMany({
    where: and(...conditions),
    columns: { id: true, title: true, dueDate: true, status: true },
    orderBy: (tasks, { asc }) => [asc(tasks.dueDate)],
    limit: 10,
  });

  return tasks;
}

/**
 * Build response for task query intent.
 */
async function handleTaskQuery(context: MessageContext, intent: IntentResult): Promise<string> {
  const timeRange = intent.entities.timeRange ?? 'this_week';
  const tasks = await getTasksForTimeRange(context.userId, context.currentProjectId, timeRange);

  if (tasks.length === 0) {
    const timeLabel = timeRange.replace('_', ' ');
    return `You have no tasks due ${timeLabel}. Great job staying on top of things!`;
  }

  const timeLabel = timeRange.replace('_', ' ');
  let response = `Here are your tasks due ${timeLabel}:\n\n`;

  for (const task of tasks) {
    const dueDateStr = task.dueDate
      ? task.dueDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : 'No due date';
    response += `- ${task.title} (${dueDateStr})\n`;
  }

  if (tasks.length === 10) {
    response += '\n...and possibly more. Check the web app for full list.';
  }

  return response;
}

/**
 * Handle switch project intent.
 */
async function handleSwitchProject(
  context: MessageContext,
  intent: IntentResult
): Promise<ProcessedMessage> {
  const projects = await getAvailableProjects(context.visibleProjectIds);

  if (projects.length === 0) {
    return {
      response: "You don't have access to any projects yet.",
    };
  }

  // If project name mentioned, try to match
  if (intent.entities.projectName) {
    const searchName = intent.entities.projectName.toLowerCase();
    const match = projects.find(
      (p) => p.name.toLowerCase().includes(searchName) || searchName.includes(p.name.toLowerCase())
    );

    if (match) {
      await switchProject(context.userId, match.id);
      return {
        response: `Switched to project: ${match.name}`,
        newProjectId: match.id,
      };
    }
    return {
      response: `Couldn't find a project matching "${intent.entities.projectName}". Available projects:\n\n${projects.map((p) => `- ${p.name}`).join('\n')}`,
    };
  }

  // No project specified - show list
  const currentProject = context.currentProjectId
    ? projects.find((p) => p.id === context.currentProjectId)
    : null;

  let response = currentProject
    ? `Current project: ${currentProject.name}\n\n`
    : 'No project selected.\n\n';

  response += 'Available projects:\n';
  response += projects.map((p) => `- ${p.name}`).join('\n');
  response += '\n\nReply with the project name to switch.';

  return { response };
}

/**
 * Handle report_blocker intent.
 */
async function handleReportBlocker(
  context: MessageContext,
  intent: IntentResult,
  originalMessage: string
): Promise<ProcessedMessage> {
  if (!context.currentProjectId) {
    return {
      response: "Please select a project first. Say 'switch' to see available projects.",
    };
  }

  // Use extracted blocker description or fall back to original message
  const description = intent.entities.blockerDescription || originalMessage;

  // Find task if mentioned
  let taskId: string | undefined;
  if (intent.entities.taskTitle) {
    const task = await db.query.tasks.findFirst({
      where: and(
        eq(schema.tasks.projectId, context.currentProjectId),
        eq(schema.tasks.assigneeId, context.userId)
      ),
      columns: { id: true, title: true },
    });
    if (task) {
      taskId = task.id;
    }
  }

  try {
    const blocker = await reportBlocker(context.currentProjectId, context.userId, {
      description,
      taskId,
    });

    logger.info(
      { blockerId: blocker.id, userId: context.userId, projectId: context.currentProjectId },
      'Blocker reported via messaging'
    );

    return {
      response:
        "I've logged your blocker and notified the appropriate people. " +
        'They will follow up to help resolve it.\n\n' +
        `Blocker: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
    };
  } catch (err) {
    logger.error({ err, userId: context.userId }, 'Failed to report blocker via messaging');
    return {
      response:
        'Sorry, I had trouble logging your blocker. Please try again or report it in the web app.',
    };
  }
}

/**
 * Process an incoming message from any platform.
 *
 * Main entry point for NLU pipeline. Detects intent, routes to handler,
 * and returns response.
 *
 * @param userId - User ID (from linked account)
 * @param message - User's message text
 * @param platform - Source platform
 * @returns Processed message with response and optional new project ID
 */
export async function processMessage(
  userId: string,
  message: string,
  platform: 'telegram' | 'whatsapp'
): Promise<ProcessedMessage> {
  // Get user context
  const context = await getUserContext(userId);
  if (!context) {
    return { response: 'Unable to load your context. Please try again.' };
  }

  // Detect intent
  const intent = await detectIntent(message, context.organizationId);

  logger.info(
    { userId, intent: intent.intent, confidence: intent.confidence, platform },
    'Processing message'
  );

  // Handle based on intent
  switch (intent.intent) {
    case 'query_tasks':
      return { response: await handleTaskQuery(context, intent) };

    case 'switch_project':
      return handleSwitchProject(context, intent);

    case 'report_blocker':
      return handleReportBlocker(context, intent, message);

    case 'help':
      return {
        response:
          'I can help you with:\n\n' +
          '- "What\'s due today/this week?" - See upcoming tasks\n' +
          '- "Switch to [project name]" - Change project context\n' +
          '- "I\'m blocked on..." - Report a blocker\n' +
          '- "Squad status" - Get project overview\n' +
          '- Ask any question about your tasks!\n\n' +
          `Current project: ${context.currentProjectId ? 'Set' : 'Not set (use switch to select one)'}`,
      };

    case 'query_status':
    case 'create_task':
    case 'update_task':
    case 'general_chat': {
      // Use conversation service for complex queries
      if (!context.currentProjectId) {
        return {
          response: "Please select a project first. Say 'switch' to see available projects.",
        };
      }

      // Get or create conversation
      let conversationId = context.conversationId;
      if (!conversationId) {
        conversationId = await createConversation({
          userId: context.userId,
          organizationId: context.organizationId,
          projectId: context.currentProjectId,
        });
      }

      // Send message through conversation service
      const result = await conversationSendMessage(
        conversationId,
        message,
        context.organizationId,
        context.userId,
        context.visibleProjectIds,
        context.currentProjectId
      );

      return { response: result.message.content };
    }

    default:
      if (intent.confidence < 0.5) {
        return {
          response:
            "I'm not sure what you're asking. Try:\n" +
            "- 'What's due this week?'\n" +
            "- 'Switch project'\n" +
            "- 'Help'",
        };
      }
      return { response: "I couldn't understand that. Type 'help' for available commands." };
  }
}

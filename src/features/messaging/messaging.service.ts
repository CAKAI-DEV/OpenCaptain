/**
 * Unified message processing service for messaging channels.
 *
 * Processes natural language messages from Telegram and WhatsApp,
 * routing to appropriate handlers based on detected intent.
 */
import { and, eq, gte, lte, ne } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import {
  deletePendingTaskConfirmation,
  getPendingTaskConfirmation,
  setPendingTaskConfirmation,
} from '../../shared/lib/redis';
import { sendMessage as conversationSendMessage, createConversation } from '../conversations';
import { reportBlocker } from '../escalations';
import { createTask } from '../tasks/tasks.service';
import { getAvailableProjects, getUserContext, switchProject } from './messaging.context';
import { detectIntent } from './messaging.intents';
import { extractTaskFromMessage } from './messaging.task-extraction';
import type {
  IntentResult,
  MessageContext,
  PendingTaskConfirmation,
  ProcessedMessage,
  TaskExtractionResult,
} from './messaging.types';

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
 * Format a confirmation message for task creation.
 */
function formatTaskConfirmationMessage(extractedTask: TaskExtractionResult): string {
  let message = "I'll create this task:\n\n";

  if (extractedTask.title) {
    message += `*Title:* ${extractedTask.title}\n`;
  }
  if (extractedTask.description) {
    message += `*Description:* ${extractedTask.description}\n`;
  }
  if (extractedTask.priority) {
    const priorityEmoji: Record<string, string> = {
      low: '',
      medium: '',
      high: '!',
      urgent: '!!',
    };
    message += `*Priority:* ${extractedTask.priority.charAt(0).toUpperCase() + extractedTask.priority.slice(1)} ${priorityEmoji[extractedTask.priority] || ''}\n`;
  }
  if (extractedTask.dueDate) {
    message += `*Due:* ${extractedTask.dueDate}\n`;
  }
  if (extractedTask.assigneeHint) {
    message += `*Assignee hint:* ${extractedTask.assigneeHint}\n`;
  }

  message += '\nReply "yes" to confirm, "no" to cancel, or tell me what to change.';

  return message;
}

/**
 * Parse relative due date string to Date object.
 */
function parseRelativeDueDate(dueDateHint: string | null): Date | undefined {
  if (!dueDateHint) return undefined;

  const hint = dueDateHint.toLowerCase();
  const now = new Date();

  if (hint.includes('today')) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  }

  if (hint.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 0);
    return tomorrow;
  }

  if (hint.includes('next week') || hint.includes('week')) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }

  // Handle day names (Monday, Tuesday, etc.)
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (day && hint.includes(day)) {
      const targetDay = i;
      const currentDay = now.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7; // Next occurrence
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysUntil);
      targetDate.setHours(23, 59, 59, 0);
      return targetDate;
    }
  }

  if (hint.includes('end of week')) {
    const endOfWeek = new Date(now);
    const daysUntilFriday = 5 - now.getDay();
    endOfWeek.setDate(endOfWeek.getDate() + (daysUntilFriday <= 0 ? 7 + daysUntilFriday : daysUntilFriday));
    endOfWeek.setHours(23, 59, 59, 0);
    return endOfWeek;
  }

  if (hint.includes('end of month')) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  return undefined;
}

/**
 * Handle task creation intent - show confirmation.
 */
async function handleTaskCreationIntent(
  context: MessageContext,
  extractedTask: TaskExtractionResult
): Promise<ProcessedMessage> {
  if (!context.currentProjectId) {
    return {
      response: "Please select a project first. Say 'switch' to see available projects.",
    };
  }

  // Store pending confirmation in Redis (5 min TTL)
  const pendingConfirmation: PendingTaskConfirmation = {
    userId: context.userId,
    projectId: context.currentProjectId,
    organizationId: context.organizationId,
    extractedTask,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  await setPendingTaskConfirmation(context.userId, pendingConfirmation);

  logger.info(
    { userId: context.userId, projectId: context.currentProjectId, title: extractedTask.title },
    'Task creation confirmation requested'
  );

  return {
    response: formatTaskConfirmationMessage(extractedTask),
  };
}

/**
 * Handle task confirmation response (yes/no/edit).
 */
async function handleTaskConfirmation(
  context: MessageContext,
  userResponse: string
): Promise<ProcessedMessage | null> {
  const pendingResult = await getPendingTaskConfirmation<PendingTaskConfirmation>(context.userId);

  if (!pendingResult.success || !pendingResult.data) {
    return null; // No pending confirmation
  }

  const pending = pendingResult.data;
  const response = userResponse.toLowerCase().trim();

  // Handle "yes" / "confirm"
  if (response === 'yes' || response === 'confirm' || response === 'ok' || response === 'y') {
    try {
      // Create the task
      const task = await createTask(
        {
          projectId: pending.projectId,
          title: pending.extractedTask.title || 'Untitled Task',
          description: pending.extractedTask.description || undefined,
          priority: pending.extractedTask.priority || 'medium',
          dueDate: parseRelativeDueDate(pending.extractedTask.dueDate),
        },
        pending.userId
      );

      // Clear pending confirmation
      await deletePendingTaskConfirmation(context.userId);

      logger.info(
        { taskId: task.id, userId: context.userId, title: task.title },
        'Task created via messaging'
      );

      return {
        response: `Task created: "${task.title}"\n\nYou can view and manage it in the web app.`,
      };
    } catch (err) {
      logger.error({ err, userId: context.userId }, 'Failed to create task via messaging');
      await deletePendingTaskConfirmation(context.userId);
      return {
        response: 'Sorry, I had trouble creating that task. Please try again or use the web app.',
      };
    }
  }

  // Handle "no" / "cancel"
  if (response === 'no' || response === 'cancel' || response === 'n' || response === 'nevermind') {
    await deletePendingTaskConfirmation(context.userId);
    return {
      response: 'Task creation cancelled. Let me know if you need anything else!',
    };
  }

  // Handle edits - user is providing modifications
  // Re-extract with the updated message
  const updatedExtraction = await extractTaskFromMessage(userResponse);

  if (updatedExtraction.isTaskCreation && updatedExtraction.confidence > 0.5) {
    // Merge the new extraction with existing
    const mergedTask: TaskExtractionResult = {
      isTaskCreation: true,
      title: updatedExtraction.title || pending.extractedTask.title,
      description: updatedExtraction.description || pending.extractedTask.description,
      assigneeHint: updatedExtraction.assigneeHint || pending.extractedTask.assigneeHint,
      dueDate: updatedExtraction.dueDate || pending.extractedTask.dueDate,
      priority: updatedExtraction.priority || pending.extractedTask.priority,
      confidence: updatedExtraction.confidence,
    };

    // Update pending confirmation
    const updatedPending: PendingTaskConfirmation = {
      ...pending,
      extractedTask: mergedTask,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    await setPendingTaskConfirmation(context.userId, updatedPending);

    return {
      response: `Updated! ${formatTaskConfirmationMessage(mergedTask)}`,
    };
  }

  // If we can't parse as an edit, prompt user again
  return {
    response:
      'I didn\'t catch that. Reply "yes" to confirm the task, "no" to cancel, or describe what you\'d like to change.',
  };
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

  // Check for pending task confirmation first
  const confirmationResult = await handleTaskConfirmation(context, message);
  if (confirmationResult) {
    logger.info({ userId, platform }, 'Handled task confirmation response');
    return confirmationResult;
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
          '- "Create a task: [description]" - Create a new task\n' +
          '- "Switch to [project name]" - Change project context\n' +
          '- "I\'m blocked on..." - Report a blocker\n' +
          '- "Squad status" - Get project overview\n' +
          '- Ask any question about your tasks!\n\n' +
          `Current project: ${context.currentProjectId ? 'Set' : 'Not set (use switch to select one)'}`,
      };

    case 'create_task': {
      // Use LLM to extract detailed task information
      const extractedTask = await extractTaskFromMessage(message);

      if (extractedTask.isTaskCreation && extractedTask.confidence > 0.7) {
        return handleTaskCreationIntent(context, extractedTask);
      }

      // Low confidence - fall through to conversation service
      if (!context.currentProjectId) {
        return {
          response: "Please select a project first. Say 'switch' to see available projects.",
        };
      }

      // Get or create conversation for clarification
      let conversationId = context.conversationId;
      if (!conversationId) {
        conversationId = await createConversation({
          userId: context.userId,
          organizationId: context.organizationId,
          projectId: context.currentProjectId,
        });
      }

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

    case 'query_status':
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
            "- 'Create a task'\n" +
            "- 'Switch project'\n" +
            "- 'Help'",
        };
      }
      return { response: "I couldn't understand that. Type 'help' for available commands." };
  }
}

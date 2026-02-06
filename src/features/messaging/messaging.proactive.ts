import { and, eq, gte, lt, lte, or, sql } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import {
  generateInsights,
  generateSuggestions,
  getInsightsForRole,
  getUserProjectRole,
  getUserSquad,
} from '../insights/insights.service';
import type { Insight, Suggestion, SuggestionContext } from '../insights/insights.types';

export interface TaskSummary {
  id: string;
  title: string;
  dueDate: Date | null;
  priority: string | null;
  status: string | null;
}

/**
 * Get tasks due within a range for a user
 */
export async function getUpcomingTasks(
  userId: string,
  projectId: string | null,
  range: 'today' | 'this_week' = 'today'
): Promise<TaskSummary[]> {
  const now = new Date();
  let endDate: Date;

  if (range === 'today') {
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  } else {
    endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7);
  }

  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);

  const conditions = [
    eq(schema.tasks.assigneeId, userId),
    gte(schema.tasks.dueDate, startDate),
    lte(schema.tasks.dueDate, endDate),
    or(eq(schema.tasks.status, 'todo'), eq(schema.tasks.status, 'in_progress')),
  ];

  if (projectId) {
    conditions.push(eq(schema.tasks.projectId, projectId));
  }

  const tasks = await db.query.tasks.findMany({
    where: and(...conditions),
    columns: { id: true, title: true, dueDate: true, priority: true, status: true },
    orderBy: (t, { asc }) => [asc(t.dueDate)],
    limit: 10,
  });

  return tasks;
}

/**
 * Get overdue tasks for a user
 */
export async function getOverdueTasks(
  userId: string,
  projectId: string | null
): Promise<TaskSummary[]> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const conditions = [
    eq(schema.tasks.assigneeId, userId),
    lt(schema.tasks.dueDate, now),
    or(eq(schema.tasks.status, 'todo'), eq(schema.tasks.status, 'in_progress')),
  ];

  if (projectId) {
    conditions.push(eq(schema.tasks.projectId, projectId));
  }

  const tasks = await db.query.tasks.findMany({
    where: and(...conditions),
    columns: { id: true, title: true, dueDate: true, priority: true, status: true },
    orderBy: (t, { asc }) => [asc(t.dueDate)],
    limit: 10,
  });

  return tasks;
}

/**
 * Generate daily check-in message with top suggestion if available.
 */
export async function generateDailyCheckin(
  userId: string,
  projectId: string | null
): Promise<string | null> {
  const todayTasks = await getUpcomingTasks(userId, projectId, 'today');
  const overdueTasks = await getOverdueTasks(userId, projectId);

  if (todayTasks.length === 0 && overdueTasks.length === 0) {
    return null; // No message needed
  }

  let message = "Good morning! Here's your daily update:\n\n";

  if (overdueTasks.length > 0) {
    message += `**Overdue (${overdueTasks.length}):**\n`;
    message += overdueTasks
      .slice(0, 3)
      .map((t) => `- ${t.title}`)
      .join('\n');
    if (overdueTasks.length > 3) {
      message += `\n  ...and ${overdueTasks.length - 3} more`;
    }
    message += '\n\n';
  }

  if (todayTasks.length > 0) {
    message += `**Due today (${todayTasks.length}):**\n`;
    message += todayTasks
      .slice(0, 5)
      .map((t) => `- ${t.title}`)
      .join('\n');
    if (todayTasks.length > 5) {
      message += `\n  ...and ${todayTasks.length - 5} more`;
    }
  }

  // Add top suggestion if project context is available
  if (projectId) {
    try {
      const topSuggestion = await getTopSuggestionForUser(userId, projectId);
      if (topSuggestion) {
        message += `\n\n**Suggestion:** ${topSuggestion.title}\n${topSuggestion.action}`;
      }
    } catch (error) {
      logger.warn({ error, userId, projectId }, 'Failed to get suggestion for daily checkin');
    }
  }

  return message;
}

/**
 * Generate overdue alert message
 */
export async function generateOverdueAlert(
  userId: string,
  projectId: string | null
): Promise<string | null> {
  const overdueTasks = await getOverdueTasks(userId, projectId);

  if (overdueTasks.length === 0) {
    return null;
  }

  let message = `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}:\n\n`;
  message += overdueTasks
    .slice(0, 5)
    .map((t) => {
      const daysOverdue = t.dueDate
        ? Math.floor((Date.now() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return `- ${t.title} (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue)`;
    })
    .join('\n');

  if (overdueTasks.length > 5) {
    message += `\n\n...and ${overdueTasks.length - 5} more.`;
  }

  return message;
}

/**
 * Generate weekly recap message with key insights.
 */
export async function generateWeeklyRecap(
  userId: string,
  projectId: string | null
): Promise<string | null> {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Count tasks completed this week
  const completedConditions = [
    eq(schema.tasks.assigneeId, userId),
    eq(schema.tasks.status, 'done'),
    gte(schema.tasks.completedAt, weekAgo),
  ];

  if (projectId) {
    completedConditions.push(eq(schema.tasks.projectId, projectId));
  }

  const [completedCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.tasks)
    .where(and(...completedConditions));

  // Count tasks created this week
  const createdConditions = [
    eq(schema.tasks.assigneeId, userId),
    gte(schema.tasks.createdAt, weekAgo),
  ];

  if (projectId) {
    createdConditions.push(eq(schema.tasks.projectId, projectId));
  }

  const [createdCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.tasks)
    .where(and(...createdConditions));

  // Get upcoming tasks for next week
  const upcomingTasks = await getUpcomingTasks(userId, projectId, 'this_week');

  const completed = Number(completedCount?.count ?? 0);
  const created = Number(createdCount?.count ?? 0);

  let message = 'Weekly Recap:\n\n';
  message += `- Tasks completed: ${completed}\n`;
  message += `- New tasks assigned: ${created}\n`;
  message += `- Tasks due next week: ${upcomingTasks.length}\n`;

  if (completed > created) {
    message += '\nGreat progress! You completed more than you received.';
  } else if (created > completed + 3) {
    message += '\nHeads up: Your backlog is growing. Consider prioritizing.';
  }

  // Add key insights if project context is available
  if (projectId) {
    try {
      const insights = await getKeyInsightsForUser(userId, projectId);
      if (insights.length > 0) {
        message += '\n\n**Key Insights:**\n';
        message += insights
          .slice(0, 3)
          .map((i) => `- ${i.title}`)
          .join('\n');
      }
    } catch (error) {
      logger.warn({ error, userId, projectId }, 'Failed to get insights for weekly recap');
    }
  }

  return message;
}

/**
 * Get the top suggestion for a user based on recent insights.
 */
async function getTopSuggestionForUser(
  userId: string,
  projectId: string
): Promise<Suggestion | null> {
  const role = await getUserProjectRole(projectId, userId);
  const squadId = await getUserSquad(projectId, userId);
  const { scopeType, scopeId } = await getInsightsForRole(projectId, userId, role, squadId);

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);

  const recentInsights = await generateInsights({
    projectId,
    scopeType,
    scopeId,
    timeRange: { start: startDate, end: endDate },
  });

  const context: SuggestionContext = {
    projectId,
    userId,
    role,
    recentInsights,
    squadId,
  };

  const suggestions = await generateSuggestions(context);
  return suggestions[0] ?? null;
}

/**
 * Get key insights for a user based on their role.
 */
async function getKeyInsightsForUser(userId: string, projectId: string): Promise<Insight[]> {
  const role = await getUserProjectRole(projectId, userId);
  const squadId = await getUserSquad(projectId, userId);
  const { scopeType, scopeId } = await getInsightsForRole(projectId, userId, role, squadId);

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);

  return generateInsights({
    projectId,
    scopeType,
    scopeId,
    timeRange: { start: startDate, end: endDate },
  });
}

/**
 * Generate an insight alert message for significant changes.
 *
 * Used for proactive notification when significant metric changes are detected.
 * @param _userId - User ID (reserved for future personalization)
 * @param _projectId - Project ID (reserved for future context)
 * @param insight - The insight to format as an alert
 */
export async function generateInsightAlert(
  _userId: string,
  _projectId: string,
  insight: Insight
): Promise<string> {
  const percentStr = `${Math.abs(Math.round(insight.percentChange * 100))}%`;
  const direction = insight.percentChange >= 0 ? 'up' : 'down';

  let message = `**Insight Alert**\n\n`;
  message += `${insight.title}\n\n`;
  message += `${insight.description}\n`;

  if (insight.percentChange !== 0) {
    message += `\n_${insight.metric} is ${direction} ${percentStr} compared to last period._`;
  }

  return message;
}

/**
 * Check for significant insights and return alert-worthy ones.
 *
 * Insights with >20% change are considered alert-worthy.
 */
export async function getAlertWorthyInsights(
  userId: string,
  projectId: string
): Promise<Insight[]> {
  const role = await getUserProjectRole(projectId, userId);
  const squadId = await getUserSquad(projectId, userId);
  const { scopeType, scopeId } = await getInsightsForRole(projectId, userId, role, squadId);

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);

  const insights = await generateInsights({
    projectId,
    scopeType,
    scopeId,
    timeRange: { start: startDate, end: endDate },
  });

  // Filter for significant insights (>20% change or specific types)
  const ALERT_THRESHOLD = 0.2;
  return insights.filter(
    (i) =>
      Math.abs(i.percentChange) > ALERT_THRESHOLD ||
      i.type === 'blocker_pattern' ||
      i.type === 'deadline_risk'
  );
}

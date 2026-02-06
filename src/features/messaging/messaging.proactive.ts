import { and, eq, gte, lt, lte, or, sql } from 'drizzle-orm';
import { db, schema } from '../../shared/db';

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
 * Generate daily check-in message
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
 * Generate weekly recap message
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

  return message;
}

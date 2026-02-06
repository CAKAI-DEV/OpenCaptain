import dayjs from 'dayjs';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { chatCompletionForOrg } from '../llm/llm.service';
import { buildVisibilityContext } from '../visibility/visibility.service';
import type {
  PersonalMetrics,
  ProjectMetrics,
  RecapContext,
  RecapPeriod,
  RecapScope,
  SquadMetrics,
} from './recaps.types';

/**
 * System prompt for recap generation
 */
const RECAP_SYSTEM_PROMPT = `You are a project management assistant generating recap summaries.
Be concise but highlight important patterns. Use bullet points.
Keep the tone professional but friendly.

For personal recaps: focus on individual achievements, progress, and upcoming priorities.
For squad recaps: focus on team velocity, blockers affecting the team, and collaboration patterns.
For project recaps: focus on overall progress toward goals, risks, and strategic insights.

Do not make up information. Only summarize what is provided in the context.
Keep recaps under 300 words.`;

/**
 * Determine recap scope based on user's role
 */
export async function determineRecapScope(
  userId: string,
  projectId: string,
  organizationId: string
): Promise<RecapScope> {
  const visibility = await buildVisibilityContext(userId, organizationId);

  // Admin or PM sees project-wide
  if (visibility.isAdmin || visibility.isPM) {
    return 'project';
  }

  // Check if user is a squad lead
  const membership = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.userId, userId),
      eq(schema.projectMembers.projectId, projectId)
    ),
    columns: { role: true },
  });

  if (membership?.role === 'squad_lead') {
    return 'squad';
  }

  return 'personal';
}

/**
 * Get date range for period
 */
function getPeriodRange(period: RecapPeriod): { start: Date; end: Date } {
  const now = dayjs();

  if (period === 'daily') {
    return {
      start: now.startOf('day').toDate(),
      end: now.endOf('day').toDate(),
    };
  }

  // Weekly: last 7 days
  return {
    start: now.subtract(7, 'day').startOf('day').toDate(),
    end: now.endOf('day').toDate(),
  };
}

/**
 * Build personal metrics
 */
async function buildPersonalMetrics(
  userId: string,
  projectId: string,
  range: { start: Date; end: Date }
): Promise<PersonalMetrics> {
  // Tasks completed
  const [tasksCompleted] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.assigneeId, userId),
        eq(schema.tasks.projectId, projectId),
        eq(schema.tasks.status, 'done'),
        gte(schema.tasks.completedAt, range.start),
        lte(schema.tasks.completedAt, range.end)
      )
    );

  // Deliverables completed (using final status)
  const [deliverablesCompleted] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.deliverables)
    .where(
      and(
        eq(schema.deliverables.assigneeId, userId),
        eq(schema.deliverables.projectId, projectId),
        gte(schema.deliverables.completedAt, range.start),
        lte(schema.deliverables.completedAt, range.end)
      )
    );

  // Tasks in progress
  const [tasksInProgress] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.assigneeId, userId),
        eq(schema.tasks.projectId, projectId),
        eq(schema.tasks.status, 'in_progress')
      )
    );

  return {
    tasksCompleted: Number(tasksCompleted?.count ?? 0),
    deliverablesCompleted: Number(deliverablesCompleted?.count ?? 0),
    tasksInProgress: Number(tasksInProgress?.count ?? 0),
    blockers: 0, // Will be populated from blockers table in plan 06-03
  };
}

/**
 * Build squad metrics
 */
async function buildSquadMetrics(
  userId: string,
  projectId: string,
  range: { start: Date; end: Date }
): Promise<SquadMetrics> {
  // Get user's squad
  const squadMember = await db.query.squadMembers.findFirst({
    where: eq(schema.squadMembers.userId, userId),
  });

  if (!squadMember) {
    return { totalCompleted: 0, byPerson: [], activeBlockers: 0, velocity: 0 };
  }

  // Get squad members with user emails via join
  const membersResult = await db.execute<{ user_id: string; email: string }>(sql`
    SELECT sm.user_id, u.email
    FROM squad_members sm
    JOIN users u ON sm.user_id = u.id
    WHERE sm.squad_id = ${squadMember.squadId}
  `);
  const members = membersResult as unknown as Array<{ user_id: string; email: string }>;

  // Total completed (tasks + deliverables)
  const completedByPerson: Array<{ name: string; completed: number }> = [];
  let totalCompleted = 0;

  for (const member of members) {
    const [tasks] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.assigneeId, member.user_id),
          eq(schema.tasks.projectId, projectId),
          eq(schema.tasks.status, 'done'),
          gte(schema.tasks.completedAt, range.start),
          lte(schema.tasks.completedAt, range.end)
        )
      );

    const [deliverables] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.deliverables)
      .where(
        and(
          eq(schema.deliverables.assigneeId, member.user_id),
          eq(schema.deliverables.projectId, projectId),
          gte(schema.deliverables.completedAt, range.start),
          lte(schema.deliverables.completedAt, range.end)
        )
      );

    const completed = Number(tasks?.count ?? 0) + Number(deliverables?.count ?? 0);
    totalCompleted += completed;

    completedByPerson.push({
      name: member.email?.split('@')[0] ?? 'Unknown',
      completed,
    });
  }

  const days = dayjs(range.end).diff(dayjs(range.start), 'day') || 1;

  return {
    totalCompleted,
    byPerson: completedByPerson,
    activeBlockers: 0, // Will be populated from blockers table
    velocity: Math.round((totalCompleted / days) * 10) / 10,
  };
}

/**
 * Build project metrics
 */
async function buildProjectMetrics(
  projectId: string,
  range: { start: Date; end: Date }
): Promise<ProjectMetrics> {
  // Get all squads in project
  const squads = await db.query.squads.findMany({
    where: eq(schema.squads.projectId, projectId),
    columns: { id: true, name: true },
  });

  const bySquad: Array<{ name: string; completed: number }> = [];
  let totalCompleted = 0;

  for (const squad of squads) {
    const squadMembers = await db.query.squadMembers.findMany({
      where: eq(schema.squadMembers.squadId, squad.id),
      columns: { userId: true },
    });

    const memberIds = squadMembers.map((m) => m.userId);
    let squadCompleted = 0;

    if (memberIds.length > 0) {
      // Count completed tasks
      const tasksResult = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*) as count FROM tasks
        WHERE assignee_id = ANY(${memberIds})
        AND project_id = ${projectId}
        AND status = 'done'
        AND completed_at >= ${range.start}
        AND completed_at <= ${range.end}
      `);
      squadCompleted += Number((tasksResult as unknown as Array<{ count: number }>)[0]?.count ?? 0);

      // Count completed deliverables
      const deliverablesResult = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*) as count FROM deliverables
        WHERE assignee_id = ANY(${memberIds})
        AND project_id = ${projectId}
        AND completed_at >= ${range.start}
        AND completed_at <= ${range.end}
      `);
      squadCompleted += Number(
        (deliverablesResult as unknown as Array<{ count: number }>)[0]?.count ?? 0
      );
    }

    totalCompleted += squadCompleted;
    bySquad.push({ name: squad.name, completed: squadCompleted });
  }

  // Daily breakdown
  const days = dayjs(range.end).diff(dayjs(range.start), 'day') + 1;
  const byDay: Array<{ date: string; count: number }> = [];

  for (let i = 0; i < Math.min(days, 7); i++) {
    const dayStart = dayjs(range.end).subtract(i, 'day').startOf('day').toDate();
    const dayEnd = dayjs(range.end).subtract(i, 'day').endOf('day').toDate();

    const [dayTasks] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.projectId, projectId),
          eq(schema.tasks.status, 'done'),
          gte(schema.tasks.completedAt, dayStart),
          lte(schema.tasks.completedAt, dayEnd)
        )
      );

    byDay.push({
      date: dayjs(dayStart).format('YYYY-MM-DD'),
      count: Number(dayTasks?.count ?? 0),
    });
  }

  // At-risk deadlines (due within 3 days, not done)
  const riskDate = dayjs().add(3, 'day').toDate();
  const [atRisk] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.deliverables)
    .where(
      and(
        eq(schema.deliverables.projectId, projectId),
        lte(schema.deliverables.dueDate, riskDate),
        sql`${schema.deliverables.completedAt} IS NULL`
      )
    );

  return {
    totalCompleted,
    bySquad,
    byDay: byDay.reverse(),
    criticalBlockers: 0, // Will be populated from blockers
    atRiskDeadlines: Number(atRisk?.count ?? 0),
  };
}

/**
 * Get upcoming deadlines
 */
async function getUpcomingDeadlines(
  userId: string,
  projectId: string,
  scope: RecapScope,
  limit = 5
): Promise<Array<{ title: string; dueDate: Date; type: 'task' | 'deliverable' }>> {
  const now = new Date();
  const result: Array<{ title: string; dueDate: Date; type: 'task' | 'deliverable' }> = [];

  // Get tasks
  const taskConditions = [
    eq(schema.tasks.projectId, projectId),
    gte(schema.tasks.dueDate, now),
    sql`${schema.tasks.status} != 'done'`,
  ];

  if (scope === 'personal') {
    taskConditions.push(eq(schema.tasks.assigneeId, userId));
  }

  const tasks = await db.query.tasks.findMany({
    where: and(...taskConditions),
    columns: { title: true, dueDate: true },
    orderBy: (t, { asc }) => [asc(t.dueDate)],
    limit,
  });

  for (const task of tasks) {
    if (task.dueDate) {
      result.push({ title: task.title, dueDate: task.dueDate, type: 'task' });
    }
  }

  // Get deliverables
  const deliverableConditions = [
    eq(schema.deliverables.projectId, projectId),
    gte(schema.deliverables.dueDate, now),
    sql`${schema.deliverables.completedAt} IS NULL`,
  ];

  if (scope === 'personal') {
    deliverableConditions.push(eq(schema.deliverables.assigneeId, userId));
  }

  const deliverables = await db.query.deliverables.findMany({
    where: and(...deliverableConditions),
    columns: { title: true, dueDate: true },
    orderBy: (d, { asc }) => [asc(d.dueDate)],
    limit,
  });

  for (const deliverable of deliverables) {
    if (deliverable.dueDate) {
      result.push({ title: deliverable.title, dueDate: deliverable.dueDate, type: 'deliverable' });
    }
  }

  // Sort by due date and take top N
  return result.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()).slice(0, limit);
}

/**
 * Build recap context based on scope
 */
export async function buildRecapContext(
  userId: string,
  projectId: string,
  organizationId: string,
  period: RecapPeriod
): Promise<RecapContext> {
  const scope = await determineRecapScope(userId, projectId, organizationId);
  const range = getPeriodRange(period);

  // Get user and project names
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { email: true },
  });
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
    columns: { name: true },
  });

  // Build metrics based on scope
  let metrics: PersonalMetrics | SquadMetrics | ProjectMetrics;

  switch (scope) {
    case 'personal':
      metrics = await buildPersonalMetrics(userId, projectId, range);
      break;
    case 'squad':
      metrics = await buildSquadMetrics(userId, projectId, range);
      break;
    case 'project':
      metrics = await buildProjectMetrics(projectId, range);
      break;
  }

  const upcomingDeadlines = await getUpcomingDeadlines(userId, projectId, scope);

  return {
    scope,
    period,
    userName: user?.email?.split('@')[0] ?? 'User',
    projectName: project?.name ?? 'Project',
    metrics,
    blockers: [], // Will be populated from blockers table in 06-03
    upcomingDeadlines,
    recentActivity: [], // Could be populated from activity feed
  };
}

/**
 * Build LLM prompt based on scope
 */
function buildRecapPrompt(context: RecapContext): string {
  const periodLabel = context.period === 'daily' ? 'today' : 'this week';

  switch (context.scope) {
    case 'personal': {
      const metrics = context.metrics as PersonalMetrics;
      return `Generate a ${context.period} personal recap for ${context.userName} on project "${context.projectName}" for ${periodLabel}:

Tasks completed: ${metrics.tasksCompleted}
Deliverables completed: ${metrics.deliverablesCompleted}
Tasks in progress: ${metrics.tasksInProgress}
Active blockers: ${metrics.blockers}

Upcoming deadlines:
${context.upcomingDeadlines.map((d) => `- ${d.title} (${d.type}) due ${dayjs(d.dueDate).format('MMM D')}`).join('\n') || 'None'}

Generate a brief, encouraging summary (3-5 bullet points) focusing on achievements and upcoming priorities.`;
    }

    case 'squad': {
      const metrics = context.metrics as SquadMetrics;
      return `Generate a ${context.period} squad recap for ${context.userName}'s team on project "${context.projectName}" for ${periodLabel}:

Total team output: ${metrics.totalCompleted} items completed
Team velocity: ${metrics.velocity} items/day
Active blockers: ${metrics.activeBlockers}

By team member:
${metrics.byPerson.map((p) => `- ${p.name}: ${p.completed} completed`).join('\n')}

Upcoming deadlines:
${context.upcomingDeadlines.map((d) => `- ${d.title} due ${dayjs(d.dueDate).format('MMM D')}`).join('\n') || 'None'}

Generate a team-focused summary (4-6 bullet points) highlighting patterns, any blockers needing attention, and team collaboration.`;
    }

    case 'project': {
      const metrics = context.metrics as ProjectMetrics;
      return `Generate a ${context.period} project recap for "${context.projectName}" for ${periodLabel}:

Total output: ${metrics.totalCompleted} items completed
At-risk deadlines: ${metrics.atRiskDeadlines}
Critical blockers: ${metrics.criticalBlockers}

By squad:
${metrics.bySquad.map((s) => `- ${s.name}: ${s.completed} completed`).join('\n')}

Daily trend:
${metrics.byDay.map((d) => `- ${d.date}: ${d.count}`).join('\n')}

Generate a strategic summary (5-7 bullet points) with overall progress, risks requiring attention, and recommendations.`;
    }
  }
}

/**
 * Generate recap using LLM
 */
export async function generateRecap(
  userId: string,
  projectId: string,
  organizationId: string,
  period: RecapPeriod
): Promise<string> {
  const context = await buildRecapContext(userId, projectId, organizationId, period);

  logger.info({ userId, projectId, scope: context.scope, period }, 'Generating recap');

  const prompt = buildRecapPrompt(context);

  try {
    const result = await chatCompletionForOrg(organizationId, [
      { role: 'system', content: RECAP_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);

    // Add header with scope info
    const scopeLabel =
      context.scope === 'personal' ? 'Personal' : context.scope === 'squad' ? 'Squad' : 'Project';
    const periodLabel = period === 'daily' ? 'Daily' : 'Weekly';

    return `${periodLabel} ${scopeLabel} Recap - ${context.projectName}\n\n${result.content}`;
  } catch (err) {
    logger.error({ err, userId, projectId }, 'Failed to generate recap');

    // Fallback to simple metrics summary
    return buildFallbackRecap(context);
  }
}

/**
 * Fallback recap when LLM fails
 */
function buildFallbackRecap(context: RecapContext): string {
  const periodLabel = context.period === 'daily' ? 'Daily' : 'Weekly';
  const lines = [`${periodLabel} Recap - ${context.projectName}`, ''];

  if (context.scope === 'personal') {
    const metrics = context.metrics as PersonalMetrics;
    lines.push(`Tasks completed: ${metrics.tasksCompleted}`);
    lines.push(`Deliverables completed: ${metrics.deliverablesCompleted}`);
    lines.push(`In progress: ${metrics.tasksInProgress}`);
  } else if (context.scope === 'squad') {
    const metrics = context.metrics as SquadMetrics;
    lines.push(`Team output: ${metrics.totalCompleted} items`);
    lines.push(`Velocity: ${metrics.velocity} items/day`);
  } else {
    const metrics = context.metrics as ProjectMetrics;
    lines.push(`Total output: ${metrics.totalCompleted} items`);
    lines.push(`At-risk deadlines: ${metrics.atRiskDeadlines}`);
  }

  if (context.upcomingDeadlines.length > 0) {
    lines.push('', 'Upcoming:');
    for (const d of context.upcomingDeadlines.slice(0, 3)) {
      lines.push(`- ${d.title} (${dayjs(d.dueDate).format('MMM D')})`);
    }
  }

  return lines.join('\n');
}

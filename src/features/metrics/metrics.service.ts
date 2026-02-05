import dayjs from 'dayjs';
import { and, count, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import type {
  BurndownPoint,
  OutputMetrics,
  PersonalMetrics,
  VelocityPeriod,
} from './metrics.types';

/**
 * Get output metrics for a project within a date range.
 * Counts completed tasks and deliverables, grouped by day, person, and squad.
 */
export async function getOutputMetrics(
  projectId: string,
  startDate: Date,
  endDate: Date,
  squadId?: string
): Promise<OutputMetrics> {
  // Count completed tasks
  const taskConditions = [
    eq(schema.tasks.projectId, projectId),
    eq(schema.tasks.status, 'done'),
    isNotNull(schema.tasks.completedAt),
    gte(schema.tasks.completedAt, startDate),
    lte(schema.tasks.completedAt, endDate),
  ];

  if (squadId) {
    taskConditions.push(eq(schema.tasks.squadId, squadId));
  }

  const [taskTotal] = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(and(...taskConditions));

  // Count completed deliverables (those with completedAt set)
  // Join with deliverable_types to check if current status is final
  const deliverableResult = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) as count FROM deliverables d
    JOIN deliverable_types dt ON d.deliverable_type_id = dt.id
    WHERE d.project_id = ${projectId}
      AND d.completed_at IS NOT NULL
      AND d.completed_at >= ${startDate}
      AND d.completed_at <= ${endDate}
      ${squadId ? sql`AND d.squad_id = ${squadId}` : sql``}
  `);

  const deliverableCount = Number(
    (deliverableResult as unknown as Array<{ count: string }>)[0]?.count ?? 0
  );
  const totalCompleted = (taskTotal?.count ?? 0) + deliverableCount;

  // By day aggregation - combine tasks and deliverables
  const byDayResult = await db.execute<{ date: string; count: string }>(sql`
    SELECT
      DATE(combined.completed_at) as date,
      COUNT(*) as count
    FROM (
      SELECT completed_at FROM tasks
      WHERE project_id = ${projectId}
        AND status = 'done'
        AND completed_at IS NOT NULL
        AND completed_at >= ${startDate}
        AND completed_at <= ${endDate}
        ${squadId ? sql`AND squad_id = ${squadId}` : sql``}
      UNION ALL
      SELECT d.completed_at FROM deliverables d
      JOIN deliverable_types dt ON d.deliverable_type_id = dt.id
      WHERE d.project_id = ${projectId}
        AND d.completed_at IS NOT NULL
        AND d.completed_at >= ${startDate}
        AND d.completed_at <= ${endDate}
        ${squadId ? sql`AND d.squad_id = ${squadId}` : sql``}
    ) combined
    GROUP BY DATE(combined.completed_at)
    ORDER BY date
  `);

  const byDay = (byDayResult as unknown as Array<{ date: string; count: string }>).map((row) => ({
    date: String(row.date),
    count: Number(row.count),
  }));

  // By person - group tasks by assignee
  const byPersonResult = await db.execute<{ user_id: string; email: string; count: string }>(sql`
    SELECT
      t.assignee_id as user_id,
      u.email,
      COUNT(*) as count
    FROM tasks t
    JOIN users u ON t.assignee_id = u.id
    WHERE t.project_id = ${projectId}
      AND t.status = 'done'
      AND t.completed_at IS NOT NULL
      AND t.completed_at >= ${startDate}
      AND t.completed_at <= ${endDate}
      ${squadId ? sql`AND t.squad_id = ${squadId}` : sql``}
      AND t.assignee_id IS NOT NULL
    GROUP BY t.assignee_id, u.email
    ORDER BY count DESC
  `);

  const byPerson = (
    byPersonResult as unknown as Array<{ user_id: string; email: string; count: string }>
  ).map((row) => ({
    userId: row.user_id,
    email: row.email,
    count: Number(row.count),
  }));

  // By squad - group tasks by squad
  const bySquadResult = await db.execute<{ squad_id: string; name: string; count: string }>(sql`
    SELECT
      t.squad_id,
      s.name,
      COUNT(*) as count
    FROM tasks t
    JOIN squads s ON t.squad_id = s.id
    WHERE t.project_id = ${projectId}
      AND t.status = 'done'
      AND t.completed_at IS NOT NULL
      AND t.completed_at >= ${startDate}
      AND t.completed_at <= ${endDate}
      AND t.squad_id IS NOT NULL
    GROUP BY t.squad_id, s.name
    ORDER BY count DESC
  `);

  const bySquad = (
    bySquadResult as unknown as Array<{ squad_id: string; name: string; count: string }>
  ).map((row) => ({
    squadId: row.squad_id,
    name: row.name,
    count: Number(row.count),
  }));

  return {
    totalCompleted,
    byDay,
    byPerson,
    bySquad,
  };
}

/**
 * Calculate velocity over multiple time periods.
 * Returns array of periods from oldest to newest.
 */
export async function getVelocity(
  projectId: string,
  periodDays = 7,
  numPeriods = 4
): Promise<VelocityPeriod[]> {
  const results: VelocityPeriod[] = [];
  const now = dayjs();

  for (let i = 0; i < numPeriods; i++) {
    const periodEnd = now
      .subtract(i * periodDays, 'day')
      .endOf('day')
      .toDate();
    const periodStart = now
      .subtract((i + 1) * periodDays - 1, 'day')
      .startOf('day')
      .toDate();

    const metrics = await getOutputMetrics(projectId, periodStart, periodEnd);
    results.push({
      periodStart,
      periodEnd,
      velocity: metrics.totalCompleted,
    });
  }

  // Return oldest first
  return results.reverse();
}

/**
 * Get burndown chart data showing remaining vs ideal work.
 * Tracks tasks created before endDate and their completion progress.
 */
export async function getBurndownData(
  projectId: string,
  startDate: Date,
  endDate: Date,
  squadId?: string
): Promise<BurndownPoint[]> {
  // Get total tasks that existed at start date
  const totalConditions = [
    eq(schema.tasks.projectId, projectId),
    lte(schema.tasks.createdAt, endDate),
  ];

  if (squadId) {
    totalConditions.push(eq(schema.tasks.squadId, squadId));
  }

  const [totalResult] = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(and(...totalConditions));

  const totalWork = totalResult?.count ?? 0;

  if (totalWork === 0) {
    return [];
  }

  // Calculate ideal burndown (linear from total to 0)
  const totalDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
  const dailyIdealBurn = totalWork / totalDays;

  const burndownData: BurndownPoint[] = [];
  let current = dayjs(startDate);
  let dayIndex = 0;

  while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
    const dayEnd = current.endOf('day').toDate();

    // Count tasks completed by this day
    const completedConditions = [
      eq(schema.tasks.projectId, projectId),
      eq(schema.tasks.status, 'done'),
      isNotNull(schema.tasks.completedAt),
      lte(schema.tasks.completedAt, dayEnd),
    ];

    if (squadId) {
      completedConditions.push(eq(schema.tasks.squadId, squadId));
    }

    const [completedResult] = await db
      .select({ count: count() })
      .from(schema.tasks)
      .where(and(...completedConditions));

    const completed = completedResult?.count ?? 0;

    burndownData.push({
      date: current.format('YYYY-MM-DD'),
      remaining: Math.max(0, totalWork - completed),
      ideal: Math.max(0, Math.round(totalWork - dailyIdealBurn * dayIndex)),
    });

    current = current.add(1, 'day');
    dayIndex++;
  }

  return burndownData;
}

/**
 * Get personal metrics for a specific user.
 * Shows their completed work and comparison to project average.
 */
export async function getPersonalMetrics(
  userId: string,
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<PersonalMetrics> {
  // Count completed tasks assigned to user
  const [userTotal] = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.projectId, projectId),
        eq(schema.tasks.assigneeId, userId),
        eq(schema.tasks.status, 'done'),
        isNotNull(schema.tasks.completedAt),
        gte(schema.tasks.completedAt, startDate),
        lte(schema.tasks.completedAt, endDate)
      )
    );

  // By day for user
  const byDayResult = await db.execute<{ date: string; count: string }>(sql`
    SELECT
      DATE(completed_at) as date,
      COUNT(*) as count
    FROM tasks
    WHERE project_id = ${projectId}
      AND assignee_id = ${userId}
      AND status = 'done'
      AND completed_at IS NOT NULL
      AND completed_at >= ${startDate}
      AND completed_at <= ${endDate}
    GROUP BY DATE(completed_at)
    ORDER BY date
  `);

  const byDay = (byDayResult as unknown as Array<{ date: string; count: string }>).map((row) => ({
    date: String(row.date),
    count: Number(row.count),
  }));

  // Calculate project average per person
  const projectMetrics = await getOutputMetrics(projectId, startDate, endDate);
  const uniqueAssignees = projectMetrics.byPerson.length || 1;
  const projectAverage = Math.round(projectMetrics.totalCompleted / uniqueAssignees);

  return {
    totalCompleted: userTotal?.count ?? 0,
    byDay,
    projectAverage,
  };
}

/**
 * Insights service for generating smart insights and suggestions.
 *
 * Analyzes metrics to detect significant trends and patterns,
 * then uses LLM to generate human-readable insights and actionable suggestions.
 */
import { and, count, eq, gte, lt, lte, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { chatCompletion } from '../llm/llm.service';
import { getOutputMetrics, getVelocity } from '../metrics/metrics.service';
import type {
  Insight,
  InsightScopeType,
  InsightsRequest,
  InsightType,
  Suggestion,
  SuggestionContext,
  SuggestionPriority,
  SuggestionType,
  TrendAnalysis,
} from './insights.types';

/** Threshold for significant change (10%) */
const SIGNIFICANCE_THRESHOLD = 0.1;

/** Confidence threshold for insights */
const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Analyze metric trends by comparing current and previous periods.
 *
 * @param currentValue - Value in current period
 * @param previousValue - Value in previous period
 * @param metricName - Name of the metric being analyzed
 * @returns Trend analysis result
 */
export function analyzeMetricTrend(
  currentValue: number,
  previousValue: number,
  metricName: string
): TrendAnalysis {
  // Avoid division by zero
  const percentChange = previousValue > 0 ? (currentValue - previousValue) / previousValue : 0;

  const isSignificant = Math.abs(percentChange) >= SIGNIFICANCE_THRESHOLD;
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (percentChange > SIGNIFICANCE_THRESHOLD) {
    trend = 'up';
  } else if (percentChange < -SIGNIFICANCE_THRESHOLD) {
    trend = 'down';
  }

  return {
    metric: metricName,
    currentValue,
    previousValue,
    percentChange,
    isSignificant,
    trend,
  };
}

/**
 * Generate insights based on metrics data.
 *
 * Fetches metrics for current and previous period, detects significant changes,
 * and uses LLM to create human-readable insight descriptions.
 *
 * @param request - Insight generation request
 * @returns Array of generated insights
 */
export async function generateInsights(request: InsightsRequest): Promise<Insight[]> {
  const { projectId, scopeType, scopeId, timeRange } = request;

  // Calculate previous period (same duration, immediately before)
  const periodDays = Math.ceil(
    (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const previousStart = new Date(timeRange.start);
  previousStart.setDate(previousStart.getDate() - periodDays);
  const previousEnd = new Date(timeRange.start);
  previousEnd.setDate(previousEnd.getDate() - 1);

  // Fetch current and previous metrics
  const squadId = scopeType === 'squad' ? scopeId : undefined;

  const [currentMetrics, previousMetrics] = await Promise.all([
    getOutputMetrics(projectId, timeRange.start, timeRange.end, squadId),
    getOutputMetrics(projectId, previousStart, previousEnd, squadId),
  ]);

  // Analyze trends
  const trends: TrendAnalysis[] = [];

  // Total output trend
  const outputTrend = analyzeMetricTrend(
    currentMetrics.totalCompleted,
    previousMetrics.totalCompleted,
    'total_output'
  );
  trends.push(outputTrend);

  // Velocity trend (using getVelocity for weekly comparison)
  const velocityPeriods = await getVelocity(projectId, 7, 2);
  if (velocityPeriods.length >= 2) {
    const current = velocityPeriods[1];
    const previous = velocityPeriods[0];
    if (current && previous) {
      const velocityTrend = analyzeMetricTrend(
        current.velocity,
        previous.velocity,
        'weekly_velocity'
      );
      trends.push(velocityTrend);
    }
  }

  // Per-person output (find significant individual changes)
  const currentByPerson = new Map(currentMetrics.byPerson.map((p) => [p.userId, p.count]));
  const previousByPerson = new Map(previousMetrics.byPerson.map((p) => [p.userId, p.count]));

  for (const person of currentMetrics.byPerson) {
    const previousCount = previousByPerson.get(person.userId) ?? 0;
    const personTrend = analyzeMetricTrend(person.count, previousCount, `person_${person.email}`);
    if (personTrend.isSignificant) {
      trends.push(personTrend);
    }
  }

  // Get blocker data for blocker pattern insights
  const blockerInsights = await analyzeBlockerPatterns(projectId, timeRange.start, timeRange.end);

  // Get deadline risk insights
  const deadlineInsights = await analyzeDeadlineRisks(projectId);

  // Generate insights from significant trends
  const insights: Insight[] = [];
  const significantTrends = trends.filter((t) => t.isSignificant);

  for (const trend of significantTrends) {
    const insight = await createInsightFromTrend(trend, request);
    if (insight) {
      insights.push(insight);
    }
  }

  // Add blocker and deadline insights
  insights.push(...blockerInsights, ...deadlineInsights);

  logger.info(
    { projectId, scopeType, insightCount: insights.length },
    'Generated insights for project'
  );

  return insights;
}

/**
 * Create an insight from a trend analysis using LLM for description.
 */
async function createInsightFromTrend(
  trend: TrendAnalysis,
  request: InsightsRequest
): Promise<Insight | null> {
  const { projectId, scopeType, scopeId, timeRange } = request;

  // Determine insight type based on trend
  let type: InsightType;
  if (trend.metric === 'weekly_velocity') {
    type = 'velocity_change';
  } else if (trend.metric.startsWith('person_')) {
    type = trend.trend === 'up' ? 'output_leader' : 'trend_drop';
  } else {
    type = trend.trend === 'up' ? 'trend_rise' : 'trend_drop';
  }

  // Generate human-readable description using LLM
  const percentStr = `${Math.abs(Math.round(trend.percentChange * 100))}%`;
  const direction = trend.trend === 'up' ? 'increased' : 'decreased';

  let title: string;
  let description: string;

  try {
    const prompt = buildInsightPrompt(trend, direction, percentStr);
    const result = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'You generate concise, actionable insights about project metrics. Keep responses under 100 words.',
        },
        { role: 'user', content: prompt },
      ],
      { model: 'gpt-4o-mini', maxTokens: 150 }
    );

    // Parse LLM response (expects "Title: ... Description: ...")
    const lines = result.content.split('\n').filter((l) => l.trim());
    title = lines[0]?.replace(/^Title:\s*/i, '') ?? `${trend.metric} ${direction} ${percentStr}`;
    description =
      lines
        .slice(1)
        .join(' ')
        .replace(/^Description:\s*/i, '') ?? `${trend.metric} has ${direction} by ${percentStr}`;
  } catch (error) {
    logger.warn({ error, trend }, 'Failed to generate insight description via LLM, using fallback');
    // Fallback to basic description
    title = `${formatMetricName(trend.metric)} ${direction} ${percentStr}`;
    description = `Your ${formatMetricName(trend.metric).toLowerCase()} has ${direction} by ${percentStr} compared to the previous period (${trend.previousValue} to ${trend.currentValue}).`;
  }

  return {
    id: uuidv4(),
    type,
    title,
    description,
    metric: trend.metric,
    percentChange: trend.percentChange,
    timeRange,
    scopeType,
    scopeId: scopeId ?? projectId,
    confidence: calculateConfidence(trend),
    createdAt: new Date(),
  };
}

/**
 * Build the prompt for insight generation.
 */
function buildInsightPrompt(trend: TrendAnalysis, direction: string, percentStr: string): string {
  return `Generate a brief insight for this metric change:
Metric: ${formatMetricName(trend.metric)}
Change: ${direction} by ${percentStr}
Previous value: ${trend.previousValue}
Current value: ${trend.currentValue}

Format your response as:
Title: [One line summary, max 60 chars]
Description: [2-3 sentences explaining the change and its potential impact]`;
}

/**
 * Format a metric name for display.
 */
function formatMetricName(metric: string): string {
  if (metric.startsWith('person_')) {
    return metric.replace('person_', '').split('@')[0] + "'s output";
  }
  return metric
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Calculate confidence score based on data quality.
 */
function calculateConfidence(trend: TrendAnalysis): number {
  // Higher confidence for larger datasets and clearer trends
  let confidence = 0.5;

  // Add confidence for significant change magnitude
  if (Math.abs(trend.percentChange) > 0.3) confidence += 0.2;
  else if (Math.abs(trend.percentChange) > 0.2) confidence += 0.1;

  // Add confidence for non-zero previous value (more reliable comparison)
  if (trend.previousValue > 0) confidence += 0.2;

  // Add confidence for larger absolute numbers
  if (trend.currentValue + trend.previousValue > 10) confidence += 0.1;

  return Math.min(confidence, 1);
}

/**
 * Analyze blocker patterns to generate insights.
 */
async function analyzeBlockerPatterns(
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<Insight[]> {
  const insights: Insight[] = [];

  // Count active blockers
  const [activeBlockers] = await db
    .select({ count: count() })
    .from(schema.blockers)
    .where(and(eq(schema.blockers.projectId, projectId), eq(schema.blockers.status, 'active')));

  const activeCount = activeBlockers?.count ?? 0;

  // Count stuck blockers (active for more than 2 days)
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const [stuckBlockers] = await db
    .select({ count: count() })
    .from(schema.blockers)
    .where(
      and(
        eq(schema.blockers.projectId, projectId),
        eq(schema.blockers.status, 'active'),
        lt(schema.blockers.createdAt, twoDaysAgo)
      )
    );

  const stuckCount = stuckBlockers?.count ?? 0;

  if (stuckCount > 0) {
    insights.push({
      id: uuidv4(),
      type: 'blocker_pattern',
      title: `${stuckCount} blocker${stuckCount > 1 ? 's' : ''} stuck for 2+ days`,
      description: `There are ${stuckCount} active blockers that have been unresolved for more than 2 days. Consider escalating or reassigning these issues to unblock progress.`,
      metric: 'stuck_blockers',
      percentChange: 0,
      timeRange: { start: startDate, end: endDate },
      scopeType: 'project',
      scopeId: projectId,
      confidence: 0.9,
      createdAt: new Date(),
    });
  }

  return insights;
}

/**
 * Analyze deadline risks to generate insights.
 */
async function analyzeDeadlineRisks(projectId: string): Promise<Insight[]> {
  const insights: Insight[] = [];

  // Find tasks due in next 3 days that aren't done
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const now = new Date();

  const [atRiskTasks] = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.projectId, projectId),
        or(eq(schema.tasks.status, 'todo'), eq(schema.tasks.status, 'in_progress')),
        gte(schema.tasks.dueDate, now),
        lte(schema.tasks.dueDate, threeDaysFromNow)
      )
    );

  const atRiskCount = atRiskTasks?.count ?? 0;

  if (atRiskCount > 2) {
    insights.push({
      id: uuidv4(),
      type: 'deadline_risk',
      title: `${atRiskCount} tasks due within 3 days`,
      description: `You have ${atRiskCount} incomplete tasks with deadlines in the next 3 days. Consider prioritizing these to avoid missing deadlines.`,
      metric: 'deadline_risk',
      percentChange: 0,
      timeRange: { start: now, end: threeDaysFromNow },
      scopeType: 'project',
      scopeId: projectId,
      confidence: 0.85,
      createdAt: new Date(),
    });
  }

  return insights;
}

/**
 * Generate actionable suggestions based on insights and user context.
 *
 * Uses LLM function calling to create relevant, prioritized suggestions.
 *
 * @param context - Context for suggestion generation
 * @returns Array of prioritized suggestions
 */
export async function generateSuggestions(context: SuggestionContext): Promise<Suggestion[]> {
  const { projectId, userId, role, recentInsights, squadId } = context;

  // Get user's task summary for context
  const userTasks = await db.query.tasks.findMany({
    where: and(
      eq(schema.tasks.projectId, projectId),
      eq(schema.tasks.assigneeId, userId),
      or(eq(schema.tasks.status, 'todo'), eq(schema.tasks.status, 'in_progress'))
    ),
    columns: {
      id: true,
      title: true,
      priority: true,
      status: true,
      dueDate: true,
    },
    limit: 20,
    orderBy: (t, { desc }) => [desc(t.priority), desc(t.dueDate)],
  });

  // Build context for LLM
  const insightSummary = recentInsights.map((i) => `- ${i.title}: ${i.description}`).join('\n');

  const taskSummary = userTasks
    .map(
      (t) =>
        `- ${t.title} (${t.priority}, ${t.status}, due: ${t.dueDate?.toISOString().split('T')[0] ?? 'no date'})`
    )
    .join('\n');

  const suggestions: Suggestion[] = [];

  try {
    const prompt = `Based on the following context, generate 2-3 actionable suggestions for this ${role}.

Recent Insights:
${insightSummary || 'No recent insights'}

User's Current Tasks:
${taskSummary || 'No active tasks'}

For each suggestion, provide:
1. Type (one of: task_focus, blocker_resolution, workload_balance, deadline_alert, velocity_improvement)
2. Title (max 60 chars)
3. Description (2-3 sentences)
4. Action (specific action to take)
5. Priority (low, medium, high)

Format each suggestion as JSON on a single line:
{"type": "...", "title": "...", "description": "...", "action": "...", "priority": "..."}`;

    const result = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'You are a helpful project assistant that generates actionable suggestions to improve productivity. Output only valid JSON lines.',
        },
        { role: 'user', content: prompt },
      ],
      { model: 'gpt-4o-mini', maxTokens: 500 }
    );

    // Parse LLM response (each line is a JSON object)
    const lines = result.content.split('\n').filter((l) => l.trim().startsWith('{'));

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as {
          type: string;
          title: string;
          description: string;
          action: string;
          priority: string;
        };

        // Validate and create suggestion
        if (isValidSuggestionType(parsed.type) && isValidPriority(parsed.priority)) {
          suggestions.push({
            id: uuidv4(),
            type: parsed.type as SuggestionType,
            title: parsed.title.slice(0, 60),
            description: parsed.description,
            action: parsed.action,
            priority: parsed.priority as SuggestionPriority,
            targetUserId: userId,
            confidence: CONFIDENCE_THRESHOLD,
            relatedInsightIds: recentInsights.map((i) => i.id),
          });
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  } catch (error) {
    logger.warn({ error, projectId, userId }, 'Failed to generate suggestions via LLM');

    // Fallback: Generate basic suggestions based on task data
    if (userTasks.some((t) => t.priority === 'urgent' || t.priority === 'high')) {
      suggestions.push({
        id: uuidv4(),
        type: 'task_focus',
        title: 'Focus on high-priority tasks',
        description:
          'You have high-priority tasks that need attention. Consider tackling these first to avoid delays.',
        action: 'Review and work on your high-priority tasks today.',
        priority: 'high',
        targetUserId: userId,
        confidence: 0.7,
        relatedInsightIds: [],
      });
    }

    const overdue = userTasks.filter((t) => t.dueDate && t.dueDate < new Date());
    if (overdue.length > 0) {
      suggestions.push({
        id: uuidv4(),
        type: 'deadline_alert',
        title: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
        description: `You have ${overdue.length} overdue tasks. Update their status or extend the deadlines if needed.`,
        action: 'Review overdue tasks and update their status or due dates.',
        priority: 'high',
        targetUserId: userId,
        confidence: 0.9,
        relatedInsightIds: [],
      });
    }
  }

  // Sort by priority
  const priorityOrder: Record<SuggestionPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  logger.info(
    { projectId, userId, suggestionCount: suggestions.length },
    'Generated suggestions for user'
  );

  return suggestions;
}

/**
 * Type guard for suggestion types.
 */
function isValidSuggestionType(type: string): boolean {
  return [
    'task_focus',
    'blocker_resolution',
    'workload_balance',
    'deadline_alert',
    'velocity_improvement',
  ].includes(type);
}

/**
 * Type guard for priority levels.
 */
function isValidPriority(priority: string): boolean {
  return ['low', 'medium', 'high'].includes(priority);
}

/**
 * Get insights scoped by user role.
 *
 * - Admin/PM: All project insights
 * - Squad lead: Squad insights + personal
 * - Member: Personal insights only
 */
export async function getInsightsForRole(
  projectId: string,
  userId: string,
  role: 'admin' | 'pm' | 'lead' | 'member',
  squadId?: string
): Promise<{ scopeType: InsightScopeType; scopeId?: string }> {
  switch (role) {
    case 'admin':
    case 'pm':
      return { scopeType: 'project', scopeId: projectId };
    case 'lead':
      return { scopeType: 'squad', scopeId: squadId };
    case 'member':
    default:
      return { scopeType: 'personal', scopeId: userId };
  }
}

/**
 * Determine user's role from project membership.
 */
export async function getUserProjectRole(
  projectId: string,
  userId: string
): Promise<'admin' | 'pm' | 'lead' | 'member'> {
  const membership = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.projectId, projectId),
      eq(schema.projectMembers.userId, userId)
    ),
  });

  if (!membership) {
    return 'member';
  }

  const role = membership.role;
  if (role === 'admin' || role === 'pm') {
    return role;
  }

  // Check if user is a squad lead
  const squadLead = await db.query.squads.findFirst({
    where: and(eq(schema.squads.projectId, projectId), eq(schema.squads.leadUserId, userId)),
  });

  if (squadLead) {
    return 'lead';
  }

  return 'member';
}

/**
 * Get user's squad in a project.
 */
export async function getUserSquad(projectId: string, userId: string): Promise<string | undefined> {
  const membership = await db.query.squadMembers.findFirst({
    where: eq(schema.squadMembers.userId, userId),
    with: {
      squad: {
        columns: { id: true, projectId: true },
      },
    },
  });

  if (membership?.squad?.projectId === projectId) {
    return membership.squad.id;
  }

  return undefined;
}

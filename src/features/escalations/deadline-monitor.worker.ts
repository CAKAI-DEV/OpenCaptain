import { Worker } from 'bullmq';
import dayjs from 'dayjs';
import { and, count, eq, gte, isNotNull, lte, ne } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { escalationQueue, getQueueConnection } from '../../shared/lib/queue/client';
import { registerWorker } from '../../shared/lib/queue/workers';
import { createDeadlineEscalation, createOutputEscalation } from './escalations.service';
import type { EscalationJobData } from './escalations.types';

/**
 * Deadline monitor worker - proactively checks for at-risk items
 *
 * This worker periodically scans for:
 * 1. Tasks/deliverables approaching deadlines without progress
 * 2. Users whose output falls below configured thresholds
 *
 * When triggers are detected, it creates escalation instances
 * that follow the configured time-windowed routing chains.
 */

/**
 * Check for tasks with approaching deadlines and no recent progress
 */
async function checkDeadlineRisks(): Promise<void> {
  logger.info('Starting deadline risk check');

  // Get all enabled deadline risk escalation blocks
  const blocks = await db.query.escalationBlocks.findMany({
    where: and(
      eq(schema.escalationBlocks.triggerType, 'deadline_risk'),
      eq(schema.escalationBlocks.enabled, true)
    ),
  });

  for (const block of blocks) {
    const warningDays = block.deadlineWarningDays ?? 3;
    const cutoffDate = dayjs().add(warningDays, 'day').toDate();
    const now = new Date();

    // Find tasks due within the warning window that are not done
    const atRiskTasks = await db.query.tasks.findMany({
      where: and(
        eq(schema.tasks.projectId, block.projectId),
        lte(schema.tasks.dueDate, cutoffDate),
        gte(schema.tasks.dueDate, now),
        ne(schema.tasks.status, 'done'),
        isNotNull(schema.tasks.assigneeId)
      ),
    });

    logger.info(
      { projectId: block.projectId, blockId: block.id, atRiskCount: atRiskTasks.length },
      'Found at-risk tasks'
    );

    for (const task of atRiskTasks) {
      if (!task.assigneeId) continue;

      // Check if block applies to this user
      const applies = await checkBlockAppliesForDeadline(block, task.assigneeId);
      if (!applies) continue;

      // Create escalation (will skip if already active)
      await createDeadlineEscalation(block.projectId, block.id, task.assigneeId, task.id);
    }

    // Also check deliverables
    const atRiskDeliverables = await db.query.deliverables.findMany({
      where: and(
        eq(schema.deliverables.projectId, block.projectId),
        lte(schema.deliverables.dueDate, cutoffDate),
        gte(schema.deliverables.dueDate, now),
        isNotNull(schema.deliverables.completedAt),
        isNotNull(schema.deliverables.assigneeId)
      ),
    });

    for (const deliverable of atRiskDeliverables) {
      if (!deliverable.assigneeId) continue;

      const applies = await checkBlockAppliesForDeadline(block, deliverable.assigneeId);
      if (!applies) continue;

      // Note: createDeadlineEscalation expects taskId, so we use deliverable.id
      // This works because escalation_instances.task_id is nullable and polymorphic
      await createDeadlineEscalation(
        block.projectId,
        block.id,
        deliverable.assigneeId,
        deliverable.id
      );
    }
  }

  logger.info('Completed deadline risk check');
}

/**
 * Check if an escalation block applies to a user (for deadline triggers)
 */
async function checkBlockAppliesForDeadline(
  block: typeof schema.escalationBlocks.$inferSelect,
  userId: string
): Promise<boolean> {
  if (block.targetType === 'all') return true;

  if (block.targetType === 'squad' && block.targetSquadId) {
    const squadMember = await db.query.squadMembers.findFirst({
      where: and(
        eq(schema.squadMembers.squadId, block.targetSquadId),
        eq(schema.squadMembers.userId, userId)
      ),
    });
    return !!squadMember;
  }

  if (block.targetType === 'role' && block.targetRole) {
    const projectMember = await db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, block.projectId),
        eq(schema.projectMembers.userId, userId),
        eq(schema.projectMembers.role, block.targetRole)
      ),
    });
    return !!projectMember;
  }

  return false;
}

/**
 * Check for users with output below threshold
 */
async function checkOutputThresholds(): Promise<void> {
  logger.info('Starting output threshold check');

  // Get all enabled output threshold escalation blocks
  const blocks = await db.query.escalationBlocks.findMany({
    where: and(
      eq(schema.escalationBlocks.triggerType, 'output_below_threshold'),
      eq(schema.escalationBlocks.enabled, true)
    ),
  });

  for (const block of blocks) {
    const threshold = block.outputThreshold ?? 1;
    const periodDays = block.outputPeriodDays ?? 7;
    const periodStart = dayjs().subtract(periodDays, 'day').toDate();

    // Get all project members
    const members = await db.query.projectMembers.findMany({
      where: eq(schema.projectMembers.projectId, block.projectId),
    });

    for (const member of members) {
      // Check if block applies to this user
      const applies = await checkBlockAppliesForDeadline(block, member.userId);
      if (!applies) continue;

      // Count completed tasks in period
      const [result] = await db
        .select({ count: count() })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.projectId, block.projectId),
            eq(schema.tasks.assigneeId, member.userId),
            eq(schema.tasks.status, 'done'),
            isNotNull(schema.tasks.completedAt),
            gte(schema.tasks.completedAt, periodStart)
          )
        );

      const completedCount = result?.count ?? 0;

      if (completedCount < threshold) {
        logger.info(
          {
            userId: member.userId,
            completedCount,
            threshold,
            periodDays,
            projectId: block.projectId,
          },
          'User below output threshold'
        );

        // Create escalation (will skip if already active)
        await createOutputEscalation(block.projectId, block.id, member.userId);
      }
    }
  }

  logger.info('Completed output threshold check');
}

/**
 * Deadline monitor worker
 */
export const deadlineMonitorWorker = new Worker<EscalationJobData>(
  'escalations',
  async (job) => {
    const { type } = job.data;
    logger.info({ jobId: job.id, type }, 'Processing deadline monitor job');

    switch (type) {
      case 'check_deadline':
        await checkDeadlineRisks();
        break;

      case 'check_output':
        await checkOutputThresholds();
        break;

      default:
        // Let other job types be handled by escalations.worker
        break;
    }
  },
  {
    connection: getQueueConnection(),
    concurrency: 1, // Run checks sequentially to avoid conflicts
  }
);

// Register for graceful shutdown
registerWorker(deadlineMonitorWorker);

/**
 * Schedule periodic deadline and output checks
 *
 * Call this on startup to ensure repeatable jobs are registered.
 */
export async function schedulePeriodicChecks(): Promise<void> {
  // Check deadlines every 4 hours
  await escalationQueue.add(
    'deadline-check',
    { type: 'check_deadline' },
    {
      repeat: {
        pattern: '0 */4 * * *', // Every 4 hours
      },
      jobId: 'deadline-check-repeatable',
    }
  );

  // Check output thresholds daily at 9 AM
  await escalationQueue.add(
    'output-check',
    { type: 'check_output' },
    {
      repeat: {
        pattern: '0 9 * * *', // Daily at 9 AM
      },
      jobId: 'output-check-repeatable',
    }
  );

  logger.info('Scheduled periodic deadline and output checks');
}

logger.info('Deadline monitor worker started');

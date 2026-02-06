import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { checkInQueue } from '../../shared/lib/queue/client';
import type {
  CheckInBlockResult,
  CreateCheckInBlockInput,
  UpdateCheckInBlockInput,
} from './check-ins.types';

/**
 * Create a new check-in block
 */
export async function createCheckInBlock(
  projectId: string,
  createdById: string,
  input: CreateCheckInBlockInput
): Promise<CheckInBlockResult> {
  const result = await db
    .insert(schema.checkInBlocks)
    .values({
      projectId,
      createdById,
      name: input.name,
      description: input.description ?? null,
      cronPattern: input.cronPattern,
      timezone: input.timezone,
      questions: input.questions,
      templateId: input.templateId ?? null,
      targetType: input.targetType,
      targetSquadId: input.targetSquadId ?? null,
      targetRole: input.targetRole ?? null,
      enabled: input.enabled,
    })
    .returning();

  const block = result[0];
  if (!block) {
    throw new Error('Failed to create check-in block');
  }

  logger.info({ blockId: block.id, projectId }, 'Check-in block created');

  // Schedule if enabled
  if (block.enabled) {
    await scheduleCheckInBlock(block.id);
  }

  return block as CheckInBlockResult;
}

/**
 * Update a check-in block
 */
export async function updateCheckInBlock(
  blockId: string,
  projectId: string,
  input: UpdateCheckInBlockInput
): Promise<CheckInBlockResult | null> {
  const [block] = await db
    .update(schema.checkInBlocks)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.checkInBlocks.id, blockId), eq(schema.checkInBlocks.projectId, projectId)))
    .returning();

  if (!block) return null;

  // Reschedule jobs
  await cancelCheckInBlockJobs(blockId);
  if (block.enabled) {
    await scheduleCheckInBlock(blockId);
  }

  logger.info({ blockId }, 'Check-in block updated');
  return block as CheckInBlockResult;
}

/**
 * Delete a check-in block
 */
export async function deleteCheckInBlock(blockId: string, projectId: string): Promise<boolean> {
  // Cancel scheduled jobs first
  await cancelCheckInBlockJobs(blockId);

  const result = await db
    .delete(schema.checkInBlocks)
    .where(and(eq(schema.checkInBlocks.id, blockId), eq(schema.checkInBlocks.projectId, projectId)))
    .returning({ id: schema.checkInBlocks.id });

  return result.length > 0;
}

/**
 * Get check-in block by ID
 */
export async function getCheckInBlock(
  blockId: string,
  projectId: string
): Promise<CheckInBlockResult | null> {
  const block = await db.query.checkInBlocks.findFirst({
    where: and(eq(schema.checkInBlocks.id, blockId), eq(schema.checkInBlocks.projectId, projectId)),
  });

  return (block as CheckInBlockResult | undefined) ?? null;
}

/**
 * List check-in blocks for a project
 */
export async function listCheckInBlocks(projectId: string): Promise<CheckInBlockResult[]> {
  const blocks = await db.query.checkInBlocks.findMany({
    where: eq(schema.checkInBlocks.projectId, projectId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return blocks as CheckInBlockResult[];
}

/**
 * Get target users for a check-in block
 */
export async function getTargetUsers(
  block: CheckInBlockResult
): Promise<Array<{ userId: string; timezone?: string }>> {
  const projectId = block.projectId;

  // Base query: all project members
  let members = await db.query.projectMembers.findMany({
    where: eq(schema.projectMembers.projectId, projectId),
    columns: { userId: true, role: true },
  });

  // Filter by target type
  if (block.targetType === 'squad' && block.targetSquadId) {
    const squadMembers = await db.query.squadMembers.findMany({
      where: eq(schema.squadMembers.squadId, block.targetSquadId),
      columns: { userId: true },
    });
    const squadUserIds = new Set(squadMembers.map((m) => m.userId));
    members = members.filter((m) => squadUserIds.has(m.userId));
  } else if (block.targetType === 'role' && block.targetRole) {
    members = members.filter((m) => m.role === block.targetRole);
  }

  // Get user timezones from user_messaging
  const userIds = members.map((m) => m.userId);
  const messagingPrefs = await db.query.userMessaging.findMany({
    where: eq(schema.userMessaging.messagingEnabled, true),
  });

  const prefsMap = new Map(messagingPrefs.map((p) => [p.userId, p]));

  // Only include users with messaging enabled
  return userIds
    .filter((userId) => prefsMap.has(userId))
    .map((userId) => ({
      userId,
      // Note: timezone would come from user preferences if we add it
    }));
}

/**
 * Schedule check-in jobs for all target users
 */
export async function scheduleCheckInBlock(blockId: string): Promise<void> {
  const block = await db.query.checkInBlocks.findFirst({
    where: eq(schema.checkInBlocks.id, blockId),
  });

  if (!block || !block.enabled) {
    logger.info({ blockId }, 'Block not found or disabled, skipping scheduling');
    return;
  }

  const users = await getTargetUsers(block as CheckInBlockResult);
  logger.info({ blockId, userCount: users.length }, 'Scheduling check-in jobs');

  for (const user of users) {
    const jobId = `check-in-${blockId}-${user.userId}`;

    await checkInQueue.add(
      jobId,
      {
        type: 'send_check_in',
        checkInBlockId: blockId,
        userId: user.userId,
      },
      {
        repeat: {
          pattern: block.cronPattern,
          tz: block.timezone, // BullMQ timezone support
        },
        jobId,
      }
    );
  }
}

/**
 * Cancel all scheduled jobs for a check-in block
 */
export async function cancelCheckInBlockJobs(blockId: string): Promise<void> {
  // Get all repeatable jobs
  const repeatableJobs = await checkInQueue.getRepeatableJobs();

  for (const job of repeatableJobs) {
    if (job.id?.startsWith(`check-in-${blockId}-`)) {
      await checkInQueue.removeRepeatableByKey(job.key);
      logger.info({ jobKey: job.key }, 'Cancelled check-in job');
    }
  }
}

/**
 * Format check-in questions as a message
 */
export function formatCheckInPrompt(name: string, questions: schema.CheckInQuestion[]): string {
  const lines = [`Check-in: ${name}`, ''];

  questions.forEach((q, i) => {
    const requiredMark = q.required ? '*' : '';
    lines.push(`${i + 1}. ${q.text}${requiredMark}`);

    if (q.type === 'select' && q.options) {
      lines.push(`   Options: ${q.options.join(', ')}`);
    } else if (q.type === 'number') {
      lines.push('   (Enter a number)');
    } else if (q.type === 'boolean') {
      lines.push('   (Yes/No)');
    }
  });

  lines.push('', 'Reply with your answers to complete the check-in.');

  return lines.join('\n');
}

/**
 * Record that a check-in was sent
 */
export async function recordCheckInSent(checkInBlockId: string, userId: string): Promise<string> {
  const result = await db
    .insert(schema.checkInResponses)
    .values({
      checkInBlockId,
      userId,
      status: 'pending',
      sentAt: new Date(),
    })
    .returning({ id: schema.checkInResponses.id });

  const response = result[0];
  if (!response) {
    throw new Error('Failed to record check-in sent');
  }

  return response.id;
}

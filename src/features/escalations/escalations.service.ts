import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import type { EscalationStep } from '../../shared/db/schema/escalation-blocks';
import { logger } from '../../shared/lib/logger';
import { escalationQueue } from '../../shared/lib/queue/client';
import { queueNotification } from '../notifications/notifications.service';
import type {
  BlockerResult,
  CreateEscalationBlockInput,
  EscalationBlockResult,
  EscalationInstanceResult,
  ReportBlockerInput,
  ResolveBlockerInput,
  UpdateEscalationBlockInput,
} from './escalations.types';

// ============================================================================
// Escalation Block CRUD
// ============================================================================

/**
 * Create a new escalation block
 */
export async function createEscalationBlock(
  projectId: string,
  createdById: string,
  input: CreateEscalationBlockInput
): Promise<EscalationBlockResult> {
  const result = await db
    .insert(schema.escalationBlocks)
    .values({
      projectId,
      createdById,
      name: input.name,
      description: input.description ?? null,
      triggerType: input.triggerType,
      deadlineWarningDays: input.deadlineWarningDays ?? null,
      outputThreshold: input.outputThreshold ?? null,
      outputPeriodDays: input.outputPeriodDays ?? null,
      targetType: input.targetType,
      targetSquadId: input.targetSquadId ?? null,
      targetRole: input.targetRole ?? null,
      escalationSteps: input.escalationSteps,
      enabled: input.enabled,
    })
    .returning();

  const block = result[0];
  if (!block) {
    throw new Error('Failed to create escalation block');
  }

  logger.info(
    { blockId: block.id, projectId, triggerType: input.triggerType },
    'Escalation block created'
  );

  return block as unknown as EscalationBlockResult;
}

/**
 * Update an escalation block
 */
export async function updateEscalationBlock(
  blockId: string,
  projectId: string,
  input: UpdateEscalationBlockInput
): Promise<EscalationBlockResult | null> {
  const [block] = await db
    .update(schema.escalationBlocks)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(
      and(eq(schema.escalationBlocks.id, blockId), eq(schema.escalationBlocks.projectId, projectId))
    )
    .returning();

  if (!block) return null;

  logger.info({ blockId }, 'Escalation block updated');
  return block as unknown as EscalationBlockResult;
}

/**
 * Delete an escalation block
 */
export async function deleteEscalationBlock(blockId: string, projectId: string): Promise<boolean> {
  // Cancel any active escalation instances
  await db
    .update(schema.escalationInstances)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(schema.escalationInstances.escalationBlockId, blockId),
        eq(schema.escalationInstances.status, 'active')
      )
    );

  const result = await db
    .delete(schema.escalationBlocks)
    .where(
      and(eq(schema.escalationBlocks.id, blockId), eq(schema.escalationBlocks.projectId, projectId))
    )
    .returning({ id: schema.escalationBlocks.id });

  return result.length > 0;
}

/**
 * Get escalation block by ID
 */
export async function getEscalationBlock(
  blockId: string,
  projectId: string
): Promise<EscalationBlockResult | null> {
  const block = await db.query.escalationBlocks.findFirst({
    where: and(
      eq(schema.escalationBlocks.id, blockId),
      eq(schema.escalationBlocks.projectId, projectId)
    ),
  });

  return (block as unknown as EscalationBlockResult | undefined) ?? null;
}

/**
 * List escalation blocks for a project
 */
export async function listEscalationBlocks(projectId: string): Promise<EscalationBlockResult[]> {
  const blocks = await db.query.escalationBlocks.findMany({
    where: eq(schema.escalationBlocks.projectId, projectId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return blocks as unknown as EscalationBlockResult[];
}

// ============================================================================
// Blocker Management
// ============================================================================

/**
 * Report a new blocker
 */
export async function reportBlocker(
  projectId: string,
  reportedById: string,
  input: ReportBlockerInput
): Promise<BlockerResult> {
  const result = await db
    .insert(schema.blockers)
    .values({
      projectId,
      reportedById,
      description: input.description,
      taskId: input.taskId ?? null,
      status: 'open',
    })
    .returning();

  const blocker = result[0];
  if (!blocker) {
    throw new Error('Failed to create blocker');
  }

  logger.info({ blockerId: blocker.id, projectId, reportedById }, 'Blocker reported');

  // Trigger escalation chain for blocker_reported
  await triggerBlockerEscalation(projectId, blocker.id, reportedById);

  return blocker as BlockerResult;
}

/**
 * Resolve a blocker
 */
export async function resolveBlocker(
  blockerId: string,
  projectId: string,
  resolvedById: string,
  input: ResolveBlockerInput
): Promise<BlockerResult | null> {
  const [blocker] = await db
    .update(schema.blockers)
    .set({
      status: 'resolved',
      resolvedById,
      resolutionNote: input.resolutionNote ?? null,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.blockers.id, blockerId), eq(schema.blockers.projectId, projectId)))
    .returning();

  if (!blocker) return null;

  // Cancel any active escalation instances for this blocker
  await cancelBlockerEscalations(blockerId);

  logger.info({ blockerId, resolvedById }, 'Blocker resolved');
  return blocker as BlockerResult;
}

/**
 * Get blocker by ID
 */
export async function getBlocker(
  blockerId: string,
  projectId: string
): Promise<BlockerResult | null> {
  const blocker = await db.query.blockers.findFirst({
    where: and(eq(schema.blockers.id, blockerId), eq(schema.blockers.projectId, projectId)),
  });

  return (blocker as BlockerResult | undefined) ?? null;
}

/**
 * List blockers for a project
 */
export async function listBlockers(projectId: string, status?: string): Promise<BlockerResult[]> {
  const conditions = [eq(schema.blockers.projectId, projectId)];
  if (status) {
    conditions.push(eq(schema.blockers.status, status));
  }

  const blockers = await db.query.blockers.findMany({
    where: and(...conditions),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return blockers as BlockerResult[];
}

// ============================================================================
// Escalation Chain Management
// ============================================================================

/**
 * Trigger escalation chain for a reported blocker
 */
async function triggerBlockerEscalation(
  projectId: string,
  blockerId: string,
  reportedById: string
): Promise<void> {
  // Find enabled escalation blocks for blocker_reported trigger
  const blocks = await db.query.escalationBlocks.findMany({
    where: and(
      eq(schema.escalationBlocks.projectId, projectId),
      eq(schema.escalationBlocks.triggerType, 'blocker_reported'),
      eq(schema.escalationBlocks.enabled, true)
    ),
  });

  for (const block of blocks) {
    // Check if this block applies to the user
    const applies = await checkBlockApplies(
      block as unknown as EscalationBlockResult,
      reportedById
    );
    if (!applies) continue;

    // Create escalation instance
    const [instance] = await db
      .insert(schema.escalationInstances)
      .values({
        projectId,
        escalationBlockId: block.id,
        triggerType: 'blocker_reported',
        blockerId,
        targetUserId: reportedById,
        currentStep: 0,
        status: 'active',
      })
      .returning();

    if (!instance) continue;

    // Schedule first escalation step
    const steps = block.escalationSteps as EscalationStep[];
    const firstStep = steps[0];
    if (firstStep) {
      await scheduleEscalationStep(instance.id, firstStep.delayMinutes);
    }

    logger.info(
      { escalationInstanceId: instance.id, blockerId, blockId: block.id },
      'Escalation chain started for blocker'
    );
  }
}

/**
 * Check if an escalation block applies to a user
 */
async function checkBlockApplies(block: EscalationBlockResult, userId: string): Promise<boolean> {
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
 * Schedule an escalation step
 */
async function scheduleEscalationStep(
  escalationInstanceId: string,
  delayMinutes: number
): Promise<void> {
  const delayMs = delayMinutes * 60 * 1000;

  await escalationQueue.add(
    `escalation-${escalationInstanceId}`,
    {
      type: 'process_escalation',
      escalationInstanceId,
    },
    {
      delay: delayMs,
      jobId: `escalation-${escalationInstanceId}-${Date.now()}`,
    }
  );

  logger.info({ escalationInstanceId, delayMinutes }, 'Scheduled escalation step');
}

/**
 * Process an escalation step - called by worker
 */
export async function processEscalationStep(escalationInstanceId: string): Promise<void> {
  const instance = await db.query.escalationInstances.findFirst({
    where: eq(schema.escalationInstances.id, escalationInstanceId),
  });

  if (!instance || instance.status !== 'active') {
    logger.info({ escalationInstanceId }, 'Escalation instance not active, skipping');
    return;
  }

  const block = await db.query.escalationBlocks.findFirst({
    where: eq(schema.escalationBlocks.id, instance.escalationBlockId),
  });

  if (!block || !block.enabled) {
    logger.info({ escalationInstanceId }, 'Escalation block not found or disabled, skipping');
    return;
  }

  const steps = block.escalationSteps as EscalationStep[];
  const currentStep = steps[instance.currentStep];

  if (!currentStep) {
    // No more steps, mark as complete
    await db
      .update(schema.escalationInstances)
      .set({ status: 'resolved', resolvedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.escalationInstances.id, escalationInstanceId));
    logger.info({ escalationInstanceId }, 'Escalation chain completed');
    return;
  }

  // Determine who to notify
  const recipientIds = await resolveEscalationRecipients(
    currentStep,
    instance.targetUserId,
    instance.projectId
  );

  // Get blocker details if this is a blocker escalation
  let blockerDescription = '';
  if (instance.blockerId) {
    const blocker = await db.query.blockers.findFirst({
      where: eq(schema.blockers.id, instance.blockerId),
    });
    blockerDescription = blocker?.description ?? '';
  }

  // Get reporter info
  const reporter = await db.query.users.findFirst({
    where: eq(schema.users.id, instance.targetUserId),
  });

  // Send notifications
  for (const recipientId of recipientIds) {
    const message = currentStep.message
      ? currentStep.message
      : `Escalation: ${reporter?.email ?? 'A team member'} reported a blocker: ${blockerDescription.substring(0, 200)}${blockerDescription.length > 200 ? '...' : ''}`;

    await queueNotification({
      type: 'escalation',
      userId: recipientId,
      title: `Escalation Alert - ${block.name}`,
      body: message,
      data: {
        escalationInstanceId,
        blockerId: instance.blockerId,
        triggerType: instance.triggerType,
      },
    });
  }

  // Update instance and schedule next step
  const nextStepIndex = instance.currentStep + 1;
  await db
    .update(schema.escalationInstances)
    .set({
      currentStep: nextStepIndex,
      lastEscalatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.escalationInstances.id, escalationInstanceId));

  // Schedule next step if exists
  if (nextStepIndex < steps.length) {
    const nextStep = steps[nextStepIndex];
    if (nextStep) {
      // Calculate delay from now (next step's delay minus current step's delay)
      const additionalDelay = nextStep.delayMinutes - currentStep.delayMinutes;
      await scheduleEscalationStep(escalationInstanceId, additionalDelay > 0 ? additionalDelay : 0);
    }
  }

  logger.info(
    { escalationInstanceId, step: instance.currentStep, recipientCount: recipientIds.length },
    'Processed escalation step'
  );
}

/**
 * Resolve who should receive an escalation notification
 */
async function resolveEscalationRecipients(
  step: EscalationStep,
  targetUserId: string,
  projectId: string
): Promise<string[]> {
  const recipients: string[] = [];

  switch (step.routeType) {
    case 'reports_to': {
      // Follow the reportsToUserId chain
      const member = await db.query.projectMembers.findFirst({
        where: and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, targetUserId)
        ),
      });
      if (member?.reportsToUserId) {
        recipients.push(member.reportsToUserId);
      }
      break;
    }

    case 'role': {
      // Notify all users with the specified role in the project
      if (step.routeRole) {
        const members = await db.query.projectMembers.findMany({
          where: and(
            eq(schema.projectMembers.projectId, projectId),
            eq(schema.projectMembers.role, step.routeRole)
          ),
        });
        recipients.push(...members.map((m) => m.userId));
      }
      break;
    }

    case 'user': {
      // Notify specific user
      if (step.routeUserId) {
        recipients.push(step.routeUserId);
      }
      break;
    }
  }

  return recipients;
}

/**
 * Cancel escalations for a resolved blocker
 */
async function cancelBlockerEscalations(blockerId: string): Promise<void> {
  const instances = await db.query.escalationInstances.findMany({
    where: and(
      eq(schema.escalationInstances.blockerId, blockerId),
      eq(schema.escalationInstances.status, 'active')
    ),
  });

  for (const instance of instances) {
    await db
      .update(schema.escalationInstances)
      .set({
        status: 'cancelled',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.escalationInstances.id, instance.id));

    logger.info(
      { escalationInstanceId: instance.id, blockerId },
      'Cancelled escalation for resolved blocker'
    );
  }
}

/**
 * Get active escalation instances for a user
 */
export async function getActiveEscalations(
  projectId: string,
  userId?: string
): Promise<EscalationInstanceResult[]> {
  const conditions = [
    eq(schema.escalationInstances.projectId, projectId),
    eq(schema.escalationInstances.status, 'active'),
  ];

  if (userId) {
    conditions.push(eq(schema.escalationInstances.targetUserId, userId));
  }

  const instances = await db.query.escalationInstances.findMany({
    where: and(...conditions),
    orderBy: (table, { desc }) => [desc(table.startedAt)],
  });

  return instances as EscalationInstanceResult[];
}

/**
 * Create escalation for deadline risk
 */
export async function createDeadlineEscalation(
  projectId: string,
  escalationBlockId: string,
  userId: string,
  taskId: string
): Promise<EscalationInstanceResult | null> {
  // Check for existing active escalation for this task
  const existing = await db.query.escalationInstances.findFirst({
    where: and(
      eq(schema.escalationInstances.projectId, projectId),
      eq(schema.escalationInstances.taskId, taskId),
      eq(schema.escalationInstances.triggerType, 'deadline_risk'),
      eq(schema.escalationInstances.status, 'active')
    ),
  });

  if (existing) {
    logger.info({ taskId }, 'Deadline escalation already active for task');
    return null;
  }

  const block = await db.query.escalationBlocks.findFirst({
    where: eq(schema.escalationBlocks.id, escalationBlockId),
  });

  if (!block) return null;

  const [instance] = await db
    .insert(schema.escalationInstances)
    .values({
      projectId,
      escalationBlockId,
      triggerType: 'deadline_risk',
      targetUserId: userId,
      taskId,
      currentStep: 0,
      status: 'active',
    })
    .returning();

  if (!instance) return null;

  // Schedule first step
  const steps = block.escalationSteps as EscalationStep[];
  const firstStep = steps[0];
  if (firstStep) {
    await scheduleEscalationStep(instance.id, firstStep.delayMinutes);
  }

  logger.info(
    { escalationInstanceId: instance.id, taskId, userId },
    'Deadline risk escalation created'
  );
  return instance as EscalationInstanceResult;
}

/**
 * Create escalation for output threshold
 */
export async function createOutputEscalation(
  projectId: string,
  escalationBlockId: string,
  userId: string
): Promise<EscalationInstanceResult | null> {
  // Check for existing active escalation for this user
  const existing = await db.query.escalationInstances.findFirst({
    where: and(
      eq(schema.escalationInstances.projectId, projectId),
      eq(schema.escalationInstances.targetUserId, userId),
      eq(schema.escalationInstances.triggerType, 'output_below_threshold'),
      eq(schema.escalationInstances.status, 'active')
    ),
  });

  if (existing) {
    logger.info({ userId }, 'Output threshold escalation already active for user');
    return null;
  }

  const block = await db.query.escalationBlocks.findFirst({
    where: eq(schema.escalationBlocks.id, escalationBlockId),
  });

  if (!block) return null;

  const [instance] = await db
    .insert(schema.escalationInstances)
    .values({
      projectId,
      escalationBlockId,
      triggerType: 'output_below_threshold',
      targetUserId: userId,
      currentStep: 0,
      status: 'active',
    })
    .returning();

  if (!instance) return null;

  // Schedule first step
  const steps = block.escalationSteps as EscalationStep[];
  const firstStep = steps[0];
  if (firstStep) {
    await scheduleEscalationStep(instance.id, firstStep.delayMinutes);
  }

  logger.info({ escalationInstanceId: instance.id, userId }, 'Output threshold escalation created');
  return instance as EscalationInstanceResult;
}

/**
 * Bidirectional sync service for Linear integration.
 * Implements last-write-wins conflict resolution.
 */
import type { LinearClient } from '@linear/sdk';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../../shared/db';
import { logger } from '../../../shared/lib/logger';
import { createLinearIssue, updateLinearIssue } from './linear.client';
import {
  LINEAR_TO_PRIORITY,
  type LinearIssueData,
  type LinearStatusMapping,
  type SyncResult,
} from './linear.types';

/**
 * Task type for sync operations.
 */
interface TaskForSync {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId: string | null;
  updatedAt: Date;
}

/**
 * Syncs a BlockBot task to Linear.
 * Creates a new issue if no linearIssueId exists, otherwise updates.
 */
export async function syncTaskToLinear(
  task: TaskForSync,
  linearClient: LinearClient,
  teamId: string,
  statusMappings: LinearStatusMapping[]
): Promise<SyncResult> {
  const logContext = { taskId: task.id, teamId };

  try {
    // Check for existing sync metadata
    const existingSync = await db.query.linearSyncMetadata.findFirst({
      where: eq(schema.linearSyncMetadata.taskId, task.id),
    });

    if (existingSync) {
      // Update existing Linear issue
      const stateId = mapStatusToLinearState(task.status, statusMappings);

      const success = await updateLinearIssue(linearClient, existingSync.linearIssueId, {
        title: task.title,
        description: task.description ?? undefined,
        stateId,
        priority: task.priority,
      });

      if (success) {
        // Update sync metadata
        await db
          .update(schema.linearSyncMetadata)
          .set({
            lastSyncedAt: new Date(),
            lastSyncDirection: 'to_linear',
            lastLocalUpdatedAt: task.updatedAt,
          })
          .where(eq(schema.linearSyncMetadata.taskId, task.id));

        logger.info(
          { ...logContext, linearIssueId: existingSync.linearIssueId },
          'Updated Linear issue from task'
        );

        return {
          success: true,
          linearIssueId: existingSync.linearIssueId,
          action: 'updated',
        };
      }

      return {
        success: false,
        linearIssueId: existingSync.linearIssueId,
        error: 'Failed to update Linear issue',
        action: 'failed',
      };
    }

    // Create new Linear issue
    const stateId = mapStatusToLinearState(task.status, statusMappings);

    const issue = await createLinearIssue(linearClient, {
      teamId,
      title: task.title,
      description: task.description ?? undefined,
      stateId,
      priority: task.priority,
    });

    // Store sync metadata
    await db.insert(schema.linearSyncMetadata).values({
      taskId: task.id,
      linearIssueId: issue.id,
      linearTeamId: teamId,
      linearIdentifier: issue.identifier,
      lastSyncDirection: 'to_linear',
      lastLocalUpdatedAt: task.updatedAt,
    });

    logger.info(
      { ...logContext, linearIssueId: issue.id, identifier: issue.identifier },
      'Created Linear issue from task'
    );

    return {
      success: true,
      linearIssueId: issue.id,
      action: 'created',
    };
  } catch (error) {
    logger.error({ ...logContext, error }, 'Failed to sync task to Linear');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'failed',
    };
  }
}

/**
 * Syncs a Linear issue update to BlockBot task.
 * Called from webhook handler. Uses last-write-wins for conflict resolution.
 */
export async function syncFromLinear(
  webhookData: LinearIssueData,
  projectId: string,
  statusMappings: LinearStatusMapping[]
): Promise<SyncResult> {
  const logContext = { linearIssueId: webhookData.id, projectId };

  try {
    // Find existing sync metadata
    const existingSync = await db.query.linearSyncMetadata.findFirst({
      where: eq(schema.linearSyncMetadata.linearIssueId, webhookData.id),
    });

    if (!existingSync) {
      // Issue not synced - ignore (was created directly in Linear)
      logger.debug(logContext, 'Linear issue not tracked, skipping sync');
      return { success: true, action: 'skipped' };
    }

    // Get current task state
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, existingSync.taskId),
    });

    if (!task) {
      logger.warn({ ...logContext, taskId: existingSync.taskId }, 'Task not found for sync');
      return { success: false, error: 'Task not found', action: 'failed' };
    }

    // Last-write-wins conflict resolution
    const linearUpdatedAt = new Date(webhookData.updatedAt);
    const localUpdatedAt = task.updatedAt;

    if (localUpdatedAt > linearUpdatedAt) {
      // Local is newer - skip this update
      logger.debug(
        { ...logContext, localUpdatedAt, linearUpdatedAt },
        'Local task is newer, skipping Linear update'
      );
      return { success: true, action: 'skipped' };
    }

    // Map Linear state back to BlockBot status
    const status = mapLinearStateToStatus(webhookData.state.name, statusMappings);
    const priority = LINEAR_TO_PRIORITY[webhookData.priority] as TaskForSync['priority'];

    // Determine completedAt based on status change
    let completedAt: Date | null | undefined;
    if (status === 'done' && task.status !== 'done') {
      completedAt = new Date();
    } else if (status !== 'done' && task.status === 'done') {
      completedAt = null;
    }

    // Update local task
    await db
      .update(schema.tasks)
      .set({
        title: webhookData.title,
        description: webhookData.description ?? null,
        status,
        priority,
        ...(completedAt !== undefined && { completedAt }),
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, existingSync.taskId));

    // Update sync metadata
    await db
      .update(schema.linearSyncMetadata)
      .set({
        lastSyncedAt: new Date(),
        lastSyncDirection: 'from_linear',
        lastLinearUpdatedAt: linearUpdatedAt,
      })
      .where(eq(schema.linearSyncMetadata.linearIssueId, webhookData.id));

    logger.info({ ...logContext, taskId: existingSync.taskId }, 'Updated task from Linear issue');

    return {
      success: true,
      linearIssueId: webhookData.id,
      action: 'updated',
    };
  } catch (error) {
    logger.error({ ...logContext, error }, 'Failed to sync from Linear');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'failed',
    };
  }
}

/**
 * Gets Linear integration config for a project.
 */
export async function getLinearIntegration(projectId: string) {
  return db.query.linearIntegrations.findFirst({
    where: eq(schema.linearIntegrations.projectId, projectId),
  });
}

/**
 * Gets sync metadata for a task.
 */
export async function getLinearSyncMetadata(taskId: string) {
  return db.query.linearSyncMetadata.findFirst({
    where: eq(schema.linearSyncMetadata.taskId, taskId),
  });
}

/**
 * Maps BlockBot status to Linear state ID.
 */
function mapStatusToLinearState(
  status: 'todo' | 'in_progress' | 'done',
  mappings: LinearStatusMapping[]
): string | undefined {
  const mapping = mappings.find((m) => m.blockbotStatus === status);
  return mapping?.linearStateId;
}

/**
 * Maps Linear state name back to BlockBot status.
 * Falls back to checking state type if no exact name match.
 */
function mapLinearStateToStatus(
  linearStateName: string,
  mappings: LinearStatusMapping[]
): 'todo' | 'in_progress' | 'done' {
  // Find exact match by state name
  const mapping = mappings.find(
    (m) => m.linearStateName.toLowerCase() === linearStateName.toLowerCase()
  );

  if (mapping) {
    return mapping.blockbotStatus;
  }

  // Fallback: infer from common Linear state names
  const normalizedName = linearStateName.toLowerCase();
  if (normalizedName.includes('done') || normalizedName.includes('complete')) {
    return 'done';
  }
  if (normalizedName.includes('progress') || normalizedName.includes('started')) {
    return 'in_progress';
  }

  // Default to todo
  return 'todo';
}

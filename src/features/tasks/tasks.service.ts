import { and, count, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { ApiError } from '../../shared/middleware/error-handler';
import { createLinearClient, getLinearIntegration, syncTaskToLinear } from '../integrations/linear';
import type {
  CreateTaskInput,
  PaginatedResult,
  PaginationOptions,
  TaskFilters,
  TaskResult,
  TaskWithSubtasks,
  UpdateTaskInput,
} from './tasks.types';

/**
 * Options for task operations with Linear sync control.
 */
export interface TaskOperationOptions {
  skipLinearSync?: boolean;
}

/**
 * Maximum nesting depth for tasks.
 * 0 = top-level task, 1 = subtask, 2 = sub-subtask
 */
const MAX_DEPTH = 2;

/**
 * Valid status transitions for tasks.
 * Tasks can move: todo -> in_progress -> done (and reverse)
 */
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  todo: ['in_progress'],
  in_progress: ['todo', 'done'],
  done: ['in_progress'],
};

/**
 * Creates a new task or subtask.
 * Enforces 2-level nesting limit (depth 0, 1, 2).
 * Optionally syncs to Linear if integration is enabled.
 */
export async function createTask(
  input: CreateTaskInput,
  createdById: string,
  options?: TaskOperationOptions
): Promise<TaskResult> {
  let depth = 0;

  // If parentTaskId provided, validate nesting limit
  if (input.parentTaskId) {
    const parentTask = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, input.parentTaskId),
    });

    if (!parentTask) {
      throw new ApiError(
        404,
        'tasks/parent-not-found',
        'Parent Task Not Found',
        'The specified parent task does not exist'
      );
    }

    // Enforce max depth
    if (parentTask.depth >= MAX_DEPTH) {
      throw new ApiError(
        400,
        'tasks/max-depth-exceeded',
        'Maximum Nesting Depth Exceeded',
        `Tasks can only be nested ${MAX_DEPTH} levels deep. Cannot create sub-sub-subtasks.`
      );
    }

    depth = parentTask.depth + 1;
  }

  // Verify project exists
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, input.projectId),
  });

  if (!project) {
    throw new ApiError(
      404,
      'tasks/project-not-found',
      'Project Not Found',
      'The specified project does not exist'
    );
  }

  // Verify squad exists if provided
  if (input.squadId) {
    const squad = await db.query.squads.findFirst({
      where: eq(schema.squads.id, input.squadId),
    });

    if (!squad) {
      throw new ApiError(
        404,
        'tasks/squad-not-found',
        'Squad Not Found',
        'The specified squad does not exist'
      );
    }
  }

  // Verify assignee exists if provided
  if (input.assigneeId) {
    const assignee = await db.query.users.findFirst({
      where: eq(schema.users.id, input.assigneeId),
    });

    if (!assignee) {
      throw new ApiError(
        404,
        'tasks/assignee-not-found',
        'Assignee Not Found',
        'The specified assignee does not exist'
      );
    }
  }

  const result = await db
    .insert(schema.tasks)
    .values({
      projectId: input.projectId,
      squadId: input.squadId || null,
      parentTaskId: input.parentTaskId || null,
      depth,
      title: input.title,
      description: input.description || null,
      priority: input.priority || 'medium',
      status: 'todo',
      assigneeId: input.assigneeId || null,
      createdById,
      dueDate: input.dueDate || null,
      customFieldValues: input.customFieldValues || {},
    })
    .returning();

  const task = result[0];
  if (!task) {
    throw new ApiError(
      500,
      'tasks/creation-failed',
      'Task Creation Failed',
      'Failed to create task'
    );
  }

  // Sync to Linear if integration enabled and not skipped
  if (!options?.skipLinearSync) {
    await syncToLinearIfEnabled(task);
  }

  return task;
}

/**
 * Updates an existing task.
 * Validates status transitions and manages completedAt timestamp.
 * Optionally syncs to Linear if integration is enabled.
 */
export async function updateTask(
  taskId: string,
  input: UpdateTaskInput,
  _userId: string,
  options?: TaskOperationOptions
): Promise<TaskResult> {
  const existingTask = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
  });

  if (!existingTask) {
    throw new ApiError(
      404,
      'tasks/not-found',
      'Task Not Found',
      'The specified task does not exist'
    );
  }

  // Validate status transition if status is being changed
  if (input.status && input.status !== existingTask.status) {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[existingTask.status];
    if (!allowedTransitions?.includes(input.status)) {
      throw new ApiError(
        400,
        'tasks/invalid-status-transition',
        'Invalid Status Transition',
        `Cannot transition from '${existingTask.status}' to '${input.status}'. Allowed transitions: ${allowedTransitions?.join(', ') || 'none'}`
      );
    }
  }

  // Verify squad exists if being changed
  if (input.squadId !== undefined && input.squadId !== null) {
    const squad = await db.query.squads.findFirst({
      where: eq(schema.squads.id, input.squadId),
    });

    if (!squad) {
      throw new ApiError(
        404,
        'tasks/squad-not-found',
        'Squad Not Found',
        'The specified squad does not exist'
      );
    }
  }

  // Verify assignee exists if being changed
  if (input.assigneeId !== undefined && input.assigneeId !== null) {
    const assignee = await db.query.users.findFirst({
      where: eq(schema.users.id, input.assigneeId),
    });

    if (!assignee) {
      throw new ApiError(
        404,
        'tasks/assignee-not-found',
        'Assignee Not Found',
        'The specified assignee does not exist'
      );
    }
  }

  // Determine completedAt based on status change
  let completedAt: Date | null | undefined;
  if (input.status === 'done' && existingTask.status !== 'done') {
    completedAt = new Date();
  } else if (input.status && input.status !== 'done' && existingTask.status === 'done') {
    completedAt = null;
  }

  const result = await db
    .update(schema.tasks)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      ...(input.squadId !== undefined && { squadId: input.squadId }),
      ...(input.customFieldValues !== undefined && { customFieldValues: input.customFieldValues }),
      ...(completedAt !== undefined && { completedAt }),
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, taskId))
    .returning();

  const task = result[0];
  if (!task) {
    throw new ApiError(500, 'tasks/update-failed', 'Task Update Failed', 'Failed to update task');
  }

  // Sync to Linear if integration enabled and not skipped
  if (!options?.skipLinearSync) {
    await syncToLinearIfEnabled(task);
  }

  return task;
}

/**
 * Syncs a task to Linear if integration is enabled for the project.
 * Runs asynchronously - doesn't block task operations.
 */
async function syncToLinearIfEnabled(task: TaskResult): Promise<void> {
  try {
    const integration = await getLinearIntegration(task.projectId);

    if (!integration || !integration.enabled) {
      return;
    }

    const client = createLinearClient(integration.apiKeyEncrypted);
    const result = await syncTaskToLinear(
      task,
      client,
      integration.teamId,
      integration.statusMappings || []
    );

    if (!result.success) {
      logger.warn({ taskId: task.id, error: result.error }, 'Failed to sync task to Linear');
    }
  } catch (error) {
    // Don't fail task operation if Linear sync fails
    logger.error({ taskId: task.id, error }, 'Error syncing task to Linear');
  }
}

/**
 * Deletes a task and its subtasks (via cascade).
 */
export async function deleteTask(taskId: string, _userId: string): Promise<void> {
  const existingTask = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
  });

  if (!existingTask) {
    throw new ApiError(
      404,
      'tasks/not-found',
      'Task Not Found',
      'The specified task does not exist'
    );
  }

  await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId));
}

/**
 * Gets a single task with its immediate subtasks.
 */
export async function getTask(taskId: string): Promise<TaskWithSubtasks | null> {
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
  });

  if (!task) {
    return null;
  }

  // Fetch immediate subtasks (one level deep)
  const subtasks = await db.query.tasks.findMany({
    where: eq(schema.tasks.parentTaskId, taskId),
  });

  return {
    ...task,
    subtasks,
  };
}

/**
 * Lists tasks for a project with optional filters and pagination.
 */
export async function listTasks(
  projectId: string,
  filters?: TaskFilters,
  pagination?: PaginationOptions
): Promise<PaginatedResult<TaskResult>> {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [eq(schema.tasks.projectId, projectId)];

  if (filters?.squadId !== undefined) {
    conditions.push(eq(schema.tasks.squadId, filters.squadId));
  }

  if (filters?.assigneeId !== undefined) {
    conditions.push(eq(schema.tasks.assigneeId, filters.assigneeId));
  }

  if (filters?.status !== undefined) {
    conditions.push(eq(schema.tasks.status, filters.status));
  }

  // Handle parentTaskId filter (null = top-level only)
  if (filters?.parentTaskId === null) {
    conditions.push(isNull(schema.tasks.parentTaskId));
  } else if (filters?.parentTaskId !== undefined) {
    conditions.push(eq(schema.tasks.parentTaskId, filters.parentTaskId));
  }

  const whereClause = and(...conditions);

  // Get total count
  const [countResult] = await db.select({ count: count() }).from(schema.tasks).where(whereClause);

  const total = countResult?.count ?? 0;

  // Get paginated data
  const data = await db.query.tasks.findMany({
    where: whereClause,
    limit,
    offset,
    orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
  });

  return {
    data,
    total,
    page,
    limit,
  };
}

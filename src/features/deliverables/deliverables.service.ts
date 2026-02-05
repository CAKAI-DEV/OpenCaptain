import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { ApiError } from '../../shared/middleware/error-handler';
import {
  getDeliverableType,
  getInitialStatus,
  isFinalStatus,
  validateStatusTransition,
} from './deliverable-types.service';
import type {
  CreateDeliverableInput,
  DeliverableResult,
  ListDeliverablesFilters,
  UpdateDeliverableInput,
} from './deliverables.types';

/**
 * Create a new deliverable with the initial status from its type configuration.
 */
export async function createDeliverable(
  input: CreateDeliverableInput,
  createdById: string
): Promise<DeliverableResult> {
  const {
    projectId,
    squadId,
    deliverableTypeId,
    title,
    description,
    assigneeId,
    dueDate,
    customFieldValues,
  } = input;

  // Verify deliverable type exists
  const deliverableType = await getDeliverableType(deliverableTypeId);
  if (!deliverableType) {
    throw new ApiError(
      400,
      'deliverables/invalid-type',
      'Invalid Deliverable Type',
      'The specified deliverable type does not exist'
    );
  }

  // Verify type belongs to the same project
  if (deliverableType.projectId !== projectId) {
    throw new ApiError(
      400,
      'deliverables/type-project-mismatch',
      'Deliverable Type Project Mismatch',
      'The deliverable type does not belong to this project'
    );
  }

  // Get initial status from type config
  const initialStatus = await getInitialStatus(deliverableTypeId);
  if (!initialStatus) {
    throw new ApiError(
      500,
      'deliverables/no-initial-status',
      'No Initial Status',
      'The deliverable type has no statuses configured'
    );
  }

  const [deliverable] = await db
    .insert(schema.deliverables)
    .values({
      projectId,
      squadId: squadId ?? null,
      deliverableTypeId,
      title,
      description: description ?? null,
      status: initialStatus,
      assigneeId: assigneeId ?? null,
      createdById,
      dueDate: dueDate ?? null,
      customFieldValues: customFieldValues ?? {},
    })
    .returning();

  if (!deliverable) {
    throw new Error('Failed to create deliverable');
  }

  return deliverable;
}

/**
 * Update a deliverable. Validates status transitions against type configuration.
 */
export async function updateDeliverable(
  deliverableId: string,
  input: UpdateDeliverableInput,
  _userId: string
): Promise<DeliverableResult> {
  // Fetch existing deliverable
  const existing = await db.query.deliverables.findFirst({
    where: eq(schema.deliverables.id, deliverableId),
  });

  if (!existing) {
    throw new ApiError(
      404,
      'deliverables/not-found',
      'Deliverable Not Found',
      'The requested deliverable does not exist'
    );
  }

  // Handle status transitions
  let newCompletedAt = existing.completedAt;
  if (input.status && input.status !== existing.status) {
    // Validate the transition
    const isValidTransition = await validateStatusTransition(
      existing.deliverableTypeId,
      existing.status,
      input.status
    );

    if (!isValidTransition) {
      throw new ApiError(
        400,
        'deliverables/invalid-status-transition',
        'Invalid Status Transition',
        `Cannot transition from "${existing.status}" to "${input.status}"`
      );
    }

    // Check if new status is final
    const newStatusIsFinal = await isFinalStatus(existing.deliverableTypeId, input.status);
    const oldStatusIsFinal = await isFinalStatus(existing.deliverableTypeId, existing.status);

    if (newStatusIsFinal && !oldStatusIsFinal) {
      // Moving to final status - set completedAt
      newCompletedAt = new Date();
    } else if (!newStatusIsFinal && oldStatusIsFinal) {
      // Moving away from final status - clear completedAt
      newCompletedAt = null;
    }
  }

  const [updated] = await db
    .update(schema.deliverables)
    .set({
      squadId: input.squadId !== undefined ? input.squadId : existing.squadId,
      title: input.title ?? existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      status: input.status ?? existing.status,
      assigneeId: input.assigneeId !== undefined ? input.assigneeId : existing.assigneeId,
      dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
      customFieldValues: input.customFieldValues ?? existing.customFieldValues,
      completedAt: newCompletedAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.deliverables.id, deliverableId))
    .returning();

  if (!updated) {
    throw new Error('Failed to update deliverable');
  }

  return updated;
}

/**
 * Delete a deliverable.
 */
export async function deleteDeliverable(deliverableId: string): Promise<void> {
  const existing = await db.query.deliverables.findFirst({
    where: eq(schema.deliverables.id, deliverableId),
  });

  if (!existing) {
    throw new ApiError(
      404,
      'deliverables/not-found',
      'Deliverable Not Found',
      'The requested deliverable does not exist'
    );
  }

  await db.delete(schema.deliverables).where(eq(schema.deliverables.id, deliverableId));
}

/**
 * Get a single deliverable by ID with type info.
 */
export async function getDeliverable(deliverableId: string): Promise<DeliverableResult | null> {
  const deliverable = await db.query.deliverables.findFirst({
    where: eq(schema.deliverables.id, deliverableId),
  });

  return deliverable ?? null;
}

/**
 * List deliverables for a project with optional filters.
 */
export async function listDeliverables(
  projectId: string,
  filters?: ListDeliverablesFilters
): Promise<DeliverableResult[]> {
  const conditions = [eq(schema.deliverables.projectId, projectId)];

  if (filters?.squadId) {
    conditions.push(eq(schema.deliverables.squadId, filters.squadId));
  }
  if (filters?.assigneeId) {
    conditions.push(eq(schema.deliverables.assigneeId, filters.assigneeId));
  }
  if (filters?.status) {
    conditions.push(eq(schema.deliverables.status, filters.status));
  }
  if (filters?.deliverableTypeId) {
    conditions.push(eq(schema.deliverables.deliverableTypeId, filters.deliverableTypeId));
  }

  const deliverables = await db.query.deliverables.findMany({
    where: and(...conditions),
    orderBy: (deliverables, { desc }) => [desc(deliverables.createdAt)],
  });

  return deliverables;
}

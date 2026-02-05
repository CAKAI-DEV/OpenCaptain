import { eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import type { DeliverableTypeConfig } from '../../shared/db/schema/deliverable-types';
import { ApiError } from '../../shared/middleware/error-handler';
import { PRESET_NAMES, PRESET_TEMPLATES } from './deliverable-presets';
import type {
  CreateDeliverableTypeInput,
  DeliverableTypeResult,
  UpdateDeliverableTypeInput,
} from './deliverables.types';

/**
 * Create a new deliverable type with custom configuration.
 */
export async function createDeliverableType(
  input: CreateDeliverableTypeInput
): Promise<DeliverableTypeResult> {
  const { projectId, name, description, icon, config } = input;

  const [deliverableType] = await db
    .insert(schema.deliverableTypes)
    .values({
      projectId,
      name,
      description: description ?? null,
      icon: icon ?? null,
      config,
      isPreset: false,
    })
    .returning();

  if (!deliverableType) {
    throw new Error('Failed to create deliverable type');
  }

  return deliverableType;
}

/**
 * Create a deliverable type from a preset template.
 */
export async function createFromPreset(
  projectId: string,
  presetKey: string
): Promise<DeliverableTypeResult> {
  const template = PRESET_TEMPLATES[presetKey];

  if (!template) {
    throw new ApiError(
      400,
      'deliverable-types/invalid-preset',
      'Invalid Preset',
      `Preset "${presetKey}" does not exist. Available: ${Object.keys(PRESET_TEMPLATES).join(', ')}`
    );
  }

  const name = PRESET_NAMES[presetKey] ?? presetKey;

  const [deliverableType] = await db
    .insert(schema.deliverableTypes)
    .values({
      projectId,
      name,
      description: `${name} deliverable type`,
      config: template,
      isPreset: true,
    })
    .returning();

  if (!deliverableType) {
    throw new Error('Failed to create deliverable type from preset');
  }

  return deliverableType;
}

/**
 * Update a deliverable type's configuration.
 */
export async function updateDeliverableType(
  typeId: string,
  input: UpdateDeliverableTypeInput
): Promise<DeliverableTypeResult> {
  const existing = await db.query.deliverableTypes.findFirst({
    where: eq(schema.deliverableTypes.id, typeId),
  });

  if (!existing) {
    throw new ApiError(
      404,
      'deliverable-types/not-found',
      'Deliverable Type Not Found',
      'The requested deliverable type does not exist'
    );
  }

  const [updated] = await db
    .update(schema.deliverableTypes)
    .set({
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      icon: input.icon !== undefined ? input.icon : existing.icon,
      config: input.config ?? existing.config,
      updatedAt: new Date(),
    })
    .where(eq(schema.deliverableTypes.id, typeId))
    .returning();

  if (!updated) {
    throw new Error('Failed to update deliverable type');
  }

  return updated;
}

/**
 * Delete a deliverable type. This will cascade to all deliverables of this type.
 */
export async function deleteDeliverableType(typeId: string): Promise<void> {
  const existing = await db.query.deliverableTypes.findFirst({
    where: eq(schema.deliverableTypes.id, typeId),
  });

  if (!existing) {
    throw new ApiError(
      404,
      'deliverable-types/not-found',
      'Deliverable Type Not Found',
      'The requested deliverable type does not exist'
    );
  }

  await db.delete(schema.deliverableTypes).where(eq(schema.deliverableTypes.id, typeId));
}

/**
 * Get a single deliverable type by ID.
 */
export async function getDeliverableType(typeId: string): Promise<DeliverableTypeResult | null> {
  const deliverableType = await db.query.deliverableTypes.findFirst({
    where: eq(schema.deliverableTypes.id, typeId),
  });

  return deliverableType ?? null;
}

/**
 * List all deliverable types for a project.
 */
export async function listDeliverableTypes(projectId: string): Promise<DeliverableTypeResult[]> {
  const types = await db.query.deliverableTypes.findMany({
    where: eq(schema.deliverableTypes.projectId, projectId),
    orderBy: (types, { asc }) => [asc(types.name)],
  });

  return types;
}

/**
 * Validate if a status transition is allowed for a deliverable type.
 * Returns true if the transition is valid, false otherwise.
 */
export async function validateStatusTransition(
  typeId: string,
  fromStatus: string,
  toStatus: string
): Promise<boolean> {
  const deliverableType = await db.query.deliverableTypes.findFirst({
    where: eq(schema.deliverableTypes.id, typeId),
  });

  if (!deliverableType) {
    return false;
  }

  const config = deliverableType.config as DeliverableTypeConfig;
  return config.transitions.some((t) => t.from === fromStatus && t.to === toStatus);
}

/**
 * Get the initial status for a deliverable type (first status in the config).
 */
export async function getInitialStatus(typeId: string): Promise<string | null> {
  const deliverableType = await db.query.deliverableTypes.findFirst({
    where: eq(schema.deliverableTypes.id, typeId),
  });

  if (!deliverableType) {
    return null;
  }

  const config = deliverableType.config as DeliverableTypeConfig;
  return config.statuses[0]?.id ?? null;
}

/**
 * Check if a status is a final status for a deliverable type.
 */
export async function isFinalStatus(typeId: string, statusId: string): Promise<boolean> {
  const deliverableType = await db.query.deliverableTypes.findFirst({
    where: eq(schema.deliverableTypes.id, typeId),
  });

  if (!deliverableType) {
    return false;
  }

  const config = deliverableType.config as DeliverableTypeConfig;
  const status = config.statuses.find((s) => s.id === statusId);
  return status?.isFinal ?? false;
}

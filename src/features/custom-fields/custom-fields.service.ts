import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../shared/db';
import { ApiError } from '../../shared/middleware/error-handler';
import type {
  CreateCustomFieldInput,
  CustomFieldResult,
  UpdateCustomFieldInput,
  ValidationResult,
} from './custom-fields.types';

/**
 * Build a Zod validator for a custom field based on its type and config.
 */
export function buildFieldValidator(field: CustomFieldResult): z.ZodTypeAny {
  const config = field.config ?? {};

  switch (field.type) {
    case 'text':
      return z.string();

    case 'number': {
      let numSchema = z.number();
      if (config.min !== undefined) numSchema = numSchema.min(config.min);
      if (config.max !== undefined) numSchema = numSchema.max(config.max);
      return numSchema;
    }

    case 'date':
      // Expect ISO 8601 datetime string
      return z.string().datetime();

    case 'select': {
      const options = config.options ?? [];
      if (options.length === 0) {
        return z.string(); // Fallback if no options configured
      }
      return z.enum(options as [string, ...string[]]);
    }

    case 'multi_select': {
      const options = config.options ?? [];
      if (options.length === 0) {
        return z.array(z.string()); // Fallback if no options configured
      }
      return z.array(z.enum(options as [string, ...string[]]));
    }

    case 'url':
      return z.string().url();

    case 'file':
      return z.object({
        attachmentId: z.string().uuid(),
        filename: z.string(),
        url: z.string().url(),
      });

    case 'relation':
      // Reference to another task or deliverable by ID
      return z.string().uuid();

    default:
      return z.unknown();
  }
}

/**
 * Validate custom field values against field definitions.
 */
export async function validateCustomFieldValues(
  projectId: string,
  values: Record<string, unknown>,
  target: 'task' | 'deliverable'
): Promise<ValidationResult> {
  // Fetch all custom fields for this project that apply to the target type
  const fields = await db.query.customFields.findMany({
    where: and(
      eq(schema.customFields.projectId, projectId),
      target === 'task'
        ? eq(schema.customFields.appliesToTasks, true)
        : eq(schema.customFields.appliesToDeliverables, true)
    ),
  });

  const errors: string[] = [];

  for (const field of fields) {
    const value = values[field.id];

    // Check required fields
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`Field "${field.name}" is required`);
      continue;
    }

    // Validate type if value is present
    if (value !== undefined && value !== null && value !== '') {
      const validator = buildFieldValidator(field);
      const result = validator.safeParse(value);
      if (!result.success) {
        const errorMsg = result.error.issues.map((e: { message: string }) => e.message).join(', ');
        errors.push(`Field "${field.name}": ${errorMsg}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a new custom field definition.
 */
export async function createCustomField(input: CreateCustomFieldInput): Promise<CustomFieldResult> {
  const {
    projectId,
    name,
    type,
    config,
    required = false,
    appliesToTasks = true,
    appliesToDeliverables = true,
  } = input;

  const [field] = await db
    .insert(schema.customFields)
    .values({
      projectId,
      name,
      type,
      config: config ?? {},
      required,
      appliesToTasks,
      appliesToDeliverables,
    })
    .returning();

  if (!field) {
    throw new Error('Failed to create custom field');
  }

  return field;
}

/**
 * Update a custom field definition.
 * Note: Type changes are not allowed to prevent data inconsistency.
 */
export async function updateCustomField(
  fieldId: string,
  input: UpdateCustomFieldInput
): Promise<CustomFieldResult> {
  // Check if trying to update type (not allowed)
  if ('type' in input) {
    throw new ApiError(
      400,
      'custom-fields/type-change-not-allowed',
      'Type Change Not Allowed',
      'Cannot change the type of an existing custom field. Create a new field instead.'
    );
  }

  const existing = await db.query.customFields.findFirst({
    where: eq(schema.customFields.id, fieldId),
  });

  if (!existing) {
    throw new ApiError(
      404,
      'custom-fields/not-found',
      'Custom Field Not Found',
      'The requested custom field does not exist'
    );
  }

  const [updated] = await db
    .update(schema.customFields)
    .set({
      name: input.name ?? existing.name,
      config: input.config ?? existing.config,
      required: input.required ?? existing.required,
      appliesToTasks: input.appliesToTasks ?? existing.appliesToTasks,
      appliesToDeliverables: input.appliesToDeliverables ?? existing.appliesToDeliverables,
      updatedAt: new Date(),
    })
    .where(eq(schema.customFields.id, fieldId))
    .returning();

  if (!updated) {
    throw new Error('Failed to update custom field');
  }

  return updated;
}

/**
 * Delete a custom field definition.
 * Note: This doesn't clean up values stored in tasks/deliverables.
 */
export async function deleteCustomField(fieldId: string): Promise<void> {
  const existing = await db.query.customFields.findFirst({
    where: eq(schema.customFields.id, fieldId),
  });

  if (!existing) {
    throw new ApiError(
      404,
      'custom-fields/not-found',
      'Custom Field Not Found',
      'The requested custom field does not exist'
    );
  }

  await db.delete(schema.customFields).where(eq(schema.customFields.id, fieldId));
}

/**
 * Get a single custom field by ID.
 */
export async function getCustomField(fieldId: string): Promise<CustomFieldResult | null> {
  const field = await db.query.customFields.findFirst({
    where: eq(schema.customFields.id, fieldId),
  });
  return field ?? null;
}

/**
 * List custom fields for a project.
 * Optionally filter by target type (task or deliverable).
 */
export async function listCustomFields(
  projectId: string,
  target?: 'task' | 'deliverable'
): Promise<CustomFieldResult[]> {
  let whereCondition = eq(schema.customFields.projectId, projectId);

  if (target === 'task') {
    whereCondition = and(whereCondition, eq(schema.customFields.appliesToTasks, true))!;
  } else if (target === 'deliverable') {
    whereCondition = and(whereCondition, eq(schema.customFields.appliesToDeliverables, true))!;
  }

  const fields = await db.query.customFields.findMany({
    where: whereCondition,
    orderBy: (fields, { asc }) => [asc(fields.name)],
  });

  return fields;
}

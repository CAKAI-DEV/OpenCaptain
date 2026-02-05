import type { customFields, FieldConfig } from '../../shared/db/schema/custom-fields';

/**
 * Supported custom field types.
 */
export const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'multi_select',
  'url',
  'file',
  'relation',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * Input for creating a custom field definition.
 */
export interface CreateCustomFieldInput {
  projectId: string;
  name: string;
  type: FieldType;
  config?: FieldConfig;
  required?: boolean;
  appliesToTasks?: boolean;
  appliesToDeliverables?: boolean;
}

/**
 * Input for updating a custom field definition.
 * Note: `type` is intentionally excluded to prevent type changes after creation.
 */
export interface UpdateCustomFieldInput {
  name?: string;
  config?: FieldConfig;
  required?: boolean;
  appliesToTasks?: boolean;
  appliesToDeliverables?: boolean;
}

/**
 * Inferred type from the customFields table.
 */
export type CustomFieldResult = typeof customFields.$inferSelect;

/**
 * Result of custom field validation.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Input for validating custom field values.
 */
export interface ValidateFieldValuesInput {
  projectId: string;
  values: Record<string, unknown>;
  target: 'task' | 'deliverable';
}

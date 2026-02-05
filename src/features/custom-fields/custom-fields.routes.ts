import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import {
  createCustomField,
  deleteCustomField,
  getCustomField,
  listCustomFields,
  updateCustomField,
  validateCustomFieldValues,
} from './custom-fields.service';
import { FIELD_TYPES } from './custom-fields.types';

const fieldConfigSchema = z
  .object({
    options: z.array(z.string()).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    relationTo: z.enum(['task', 'deliverable']).optional(),
    allowMultiple: z.boolean().optional(),
  })
  .optional();

const createCustomFieldSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(FIELD_TYPES as unknown as [string, ...string[]]),
  config: fieldConfigSchema,
  required: z.boolean().optional().default(false),
  appliesToTasks: z.boolean().optional().default(true),
  appliesToDeliverables: z.boolean().optional().default(true),
});

const updateCustomFieldSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: fieldConfigSchema,
  required: z.boolean().optional(),
  appliesToTasks: z.boolean().optional(),
  appliesToDeliverables: z.boolean().optional(),
});

const validateFieldValuesSchema = z.object({
  projectId: z.string().uuid(),
  values: z.record(z.string(), z.unknown()),
  target: z.enum(['task', 'deliverable']),
});

const listQuerySchema = z.object({
  projectId: z.string().uuid(),
  target: z.enum(['task', 'deliverable']).optional(),
});

export const customFieldsRoutes = new Hono();

// Apply middleware to all routes
customFieldsRoutes.use('*', authMiddleware);
customFieldsRoutes.use('*', visibilityMiddleware);

/**
 * POST / - Create a new custom field definition (admin only)
 * Body: CreateCustomFieldInput
 * Returns 201 on success
 */
customFieldsRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const input = createCustomFieldSchema.parse(body);

  // TODO: Add admin check using ability
  // const ability = c.get('ability');
  // if (!ability.can('manage', 'CustomField')) {
  //   throw new ApiError(403, 'custom-fields/forbidden', 'Forbidden');
  // }

  const field = await createCustomField({
    projectId: input.projectId,
    name: input.name,
    type: input.type as (typeof FIELD_TYPES)[number],
    config: input.config,
    required: input.required,
    appliesToTasks: input.appliesToTasks,
    appliesToDeliverables: input.appliesToDeliverables,
  });

  return c.json({ data: field }, 201);
});

/**
 * GET / - List custom fields for a project
 * Query: projectId (required), target? ('task' | 'deliverable')
 * Returns array of custom fields
 */
customFieldsRoutes.get('/', async (c) => {
  const query = c.req.query();

  if (!query.projectId) {
    return c.json(
      {
        type: 'https://blockbot.dev/errors/custom-fields/missing-project-id',
        title: 'Missing Project ID',
        status: 400,
        detail: 'projectId query parameter is required',
      },
      400
    );
  }

  const parsed = listQuerySchema.safeParse(query);
  if (!parsed.success) {
    return c.json(
      {
        type: 'https://blockbot.dev/errors/custom-fields/invalid-query',
        title: 'Invalid Query',
        status: 400,
        detail: parsed.error.message,
      },
      400
    );
  }

  const fields = await listCustomFields(parsed.data.projectId, parsed.data.target);

  return c.json({ data: fields });
});

/**
 * GET /:fieldId - Get a single custom field by ID
 * Returns the custom field
 */
customFieldsRoutes.get('/:fieldId', async (c) => {
  const fieldId = c.req.param('fieldId');

  const field = await getCustomField(fieldId);

  if (!field) {
    return c.json(
      {
        type: 'https://blockbot.dev/errors/custom-fields/not-found',
        title: 'Custom Field Not Found',
        status: 404,
        detail: 'The requested custom field does not exist',
      },
      404
    );
  }

  return c.json({ data: field });
});

/**
 * PATCH /:fieldId - Update a custom field definition (admin only)
 * Body: UpdateCustomFieldInput (type not allowed)
 * Returns updated field or 400 if trying to change type
 */
customFieldsRoutes.patch('/:fieldId', async (c) => {
  const fieldId = c.req.param('fieldId');
  const body = await c.req.json();

  // Check if trying to update type (not allowed)
  if ('type' in body) {
    return c.json(
      {
        type: 'https://blockbot.dev/errors/custom-fields/type-change-not-allowed',
        title: 'Type Change Not Allowed',
        status: 400,
        detail: 'Cannot change the type of an existing custom field. Create a new field instead.',
      },
      400
    );
  }

  const input = updateCustomFieldSchema.parse(body);

  // TODO: Add admin check using ability

  const field = await updateCustomField(fieldId, input);

  return c.json({ data: field });
});

/**
 * DELETE /:fieldId - Delete a custom field definition (admin only)
 * Returns 204 on success
 */
customFieldsRoutes.delete('/:fieldId', async (c) => {
  const fieldId = c.req.param('fieldId');

  // TODO: Add admin check using ability

  await deleteCustomField(fieldId);

  return c.body(null, 204);
});

/**
 * POST /validate - Validate custom field values
 * Body: { projectId, values: Record<string, unknown>, target: 'task' | 'deliverable' }
 * Returns { valid: boolean, errors: string[] }
 */
customFieldsRoutes.post('/validate', async (c) => {
  const body = await c.req.json();
  const input = validateFieldValuesSchema.parse(body);

  const result = await validateCustomFieldValues(input.projectId, input.values, input.target);

  return c.json({ data: result });
});

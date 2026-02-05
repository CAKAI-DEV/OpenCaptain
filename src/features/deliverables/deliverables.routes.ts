import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { DeliverableTypeConfig } from '../../shared/db/schema/deliverable-types';
import { ApiError } from '../../shared/middleware/error-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import { PRESET_KEYS } from './deliverable-presets';
import {
  createDeliverableType,
  createFromPreset,
  deleteDeliverableType,
  getDeliverableType,
  listDeliverableTypes,
  updateDeliverableType,
} from './deliverable-types.service';
import {
  createDeliverable,
  deleteDeliverable,
  getDeliverable,
  listDeliverables,
  updateDeliverable,
} from './deliverables.service';

const deliverables = new Hono();

// All routes require authentication and visibility
deliverables.use('*', authMiddleware);
deliverables.use('*', visibilityMiddleware);

// ==================
// Validation Schemas
// ==================

const statusDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  isFinal: z.boolean(),
});

const statusTransitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const fieldDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'select', 'multi_select', 'url', 'file', 'relation']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  relationTo: z.enum(['task', 'deliverable']).optional(),
});

const deliverableTypeConfigSchema = z.object({
  statuses: z.array(statusDefinitionSchema).min(1),
  transitions: z.array(statusTransitionSchema),
  fields: z.array(fieldDefinitionSchema),
});

const createDeliverableTypeSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  icon: z.string().max(50).optional(),
  config: deliverableTypeConfigSchema,
});

const createFromPresetSchema = z.object({
  projectId: z.string().uuid(),
  preset: z.enum(PRESET_KEYS as [string, ...string[]]),
});

const updateDeliverableTypeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  config: deliverableTypeConfigSchema.optional(),
});

const createDeliverableSchema = z.object({
  projectId: z.string().uuid(),
  squadId: z.string().uuid().optional(),
  deliverableTypeId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  customFieldValues: z.record(z.string(), z.unknown()).optional(),
});

const updateDeliverableSchema = z.object({
  squadId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.string().min(1).max(100).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  customFieldValues: z.record(z.string(), z.unknown()).optional(),
});

const listDeliverablesQuerySchema = z.object({
  projectId: z.string().uuid(),
  squadId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  status: z.string().optional(),
  deliverableTypeId: z.string().uuid().optional(),
});

// =========================
// Deliverable Type Endpoints
// =========================

// POST /types - Create deliverable type
deliverables.post('/types', zValidator('json', createDeliverableTypeSchema), async (c) => {
  const input = c.req.valid('json');

  const deliverableType = await createDeliverableType({
    projectId: input.projectId,
    name: input.name,
    description: input.description,
    icon: input.icon,
    config: input.config as DeliverableTypeConfig,
  });

  return c.json(deliverableType, 201);
});

// POST /types/from-preset - Create from preset
deliverables.post('/types/from-preset', zValidator('json', createFromPresetSchema), async (c) => {
  const { projectId, preset } = c.req.valid('json');

  const deliverableType = await createFromPreset(projectId, preset);

  return c.json(deliverableType, 201);
});

// GET /types - List types for project
deliverables.get('/types', async (c) => {
  const projectId = c.req.query('projectId');

  if (!projectId) {
    throw new ApiError(
      400,
      'deliverable-types/missing-project-id',
      'Missing Project ID',
      'Query parameter projectId is required'
    );
  }

  const types = await listDeliverableTypes(projectId);
  return c.json(types);
});

// GET /types/:typeId - Get single type
deliverables.get('/types/:typeId', async (c) => {
  const typeId = c.req.param('typeId');

  const deliverableType = await getDeliverableType(typeId);

  if (!deliverableType) {
    throw new ApiError(
      404,
      'deliverable-types/not-found',
      'Deliverable Type Not Found',
      'The requested deliverable type does not exist'
    );
  }

  return c.json(deliverableType);
});

// PATCH /types/:typeId - Update type
deliverables.patch('/types/:typeId', zValidator('json', updateDeliverableTypeSchema), async (c) => {
  const typeId = c.req.param('typeId');
  const input = c.req.valid('json');

  const updated = await updateDeliverableType(typeId, {
    name: input.name,
    description: input.description ?? undefined,
    icon: input.icon ?? undefined,
    config: input.config as DeliverableTypeConfig | undefined,
  });

  return c.json(updated);
});

// DELETE /types/:typeId - Delete type
deliverables.delete('/types/:typeId', async (c) => {
  const typeId = c.req.param('typeId');

  await deleteDeliverableType(typeId);

  return c.json({ success: true });
});

// =====================
// Deliverable Endpoints
// =====================

// POST / - Create deliverable
deliverables.post('/', zValidator('json', createDeliverableSchema), async (c) => {
  const input = c.req.valid('json');
  const user = c.get('user');

  const deliverable = await createDeliverable(
    {
      projectId: input.projectId,
      squadId: input.squadId,
      deliverableTypeId: input.deliverableTypeId,
      title: input.title,
      description: input.description,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      customFieldValues: input.customFieldValues,
    },
    user.sub
  );

  return c.json(deliverable, 201);
});

// GET / - List deliverables
deliverables.get('/', zValidator('query', listDeliverablesQuerySchema), async (c) => {
  const query = c.req.valid('query');

  const results = await listDeliverables(query.projectId, {
    squadId: query.squadId,
    assigneeId: query.assigneeId,
    status: query.status,
    deliverableTypeId: query.deliverableTypeId,
  });

  return c.json(results);
});

// GET /:deliverableId - Get single deliverable
deliverables.get('/:deliverableId', async (c) => {
  const deliverableId = c.req.param('deliverableId');

  const deliverable = await getDeliverable(deliverableId);

  if (!deliverable) {
    throw new ApiError(
      404,
      'deliverables/not-found',
      'Deliverable Not Found',
      'The requested deliverable does not exist'
    );
  }

  return c.json(deliverable);
});

// PATCH /:deliverableId - Update deliverable
deliverables.patch('/:deliverableId', zValidator('json', updateDeliverableSchema), async (c) => {
  const deliverableId = c.req.param('deliverableId');
  const input = c.req.valid('json');
  const user = c.get('user');

  const updated = await updateDeliverable(
    deliverableId,
    {
      squadId: input.squadId,
      title: input.title,
      description: input.description,
      status: input.status,
      assigneeId: input.assigneeId,
      dueDate:
        input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : undefined,
      customFieldValues: input.customFieldValues,
    },
    user.sub
  );

  return c.json(updated);
});

// DELETE /:deliverableId - Delete deliverable
deliverables.delete('/:deliverableId', async (c) => {
  const deliverableId = c.req.param('deliverableId');

  await deleteDeliverable(deliverableId);

  return c.json({ success: true });
});

export { deliverables as deliverablesRoutes };

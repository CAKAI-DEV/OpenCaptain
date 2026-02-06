import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../../shared/middleware/error-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import { buildVisibilityContext } from '../visibility/visibility.service';
import {
  createEscalationBlock,
  deleteEscalationBlock,
  getActiveEscalations,
  getBlocker,
  getEscalationBlock,
  listBlockers,
  listEscalationBlocks,
  reportBlocker,
  resolveBlocker,
  updateEscalationBlock,
} from './escalations.service';
import {
  createEscalationBlockSchema,
  reportBlockerSchema,
  resolveBlockerSchema,
  updateEscalationBlockSchema,
} from './escalations.types';

const app = new Hono();

app.use('*', authMiddleware);
app.use('*', visibilityMiddleware);

// =============================================================================
// Escalation Block Routes (Admin)
// =============================================================================

// List escalation blocks for project
app.get('/projects/:projectId/escalation-blocks', async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');

  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  if (!visibilityContext.visibleProjectIds.includes(projectId)) {
    throw new ApiError(403, 'escalations/access-denied', 'Access denied to this project');
  }

  const blocks = await listEscalationBlocks(projectId);
  return c.json({ data: blocks });
});

// Create escalation block (admin/pm only)
app.post(
  '/projects/:projectId/escalation-blocks',
  zValidator('json', createEscalationBlockSchema),
  async (c) => {
    const projectId = c.req.param('projectId');
    const user = c.get('user');
    const input = c.req.valid('json');

    const visibilityContext = await buildVisibilityContext(user.sub, user.org);
    if (!visibilityContext.visibleProjectIds.includes(projectId)) {
      throw new ApiError(403, 'escalations/access-denied', 'Access denied to this project');
    }

    // TODO: Check if user is admin/pm for this project

    const block = await createEscalationBlock(projectId, user.sub, input);
    return c.json({ data: block }, 201);
  }
);

// Get escalation block
app.get('/projects/:projectId/escalation-blocks/:blockId', async (c) => {
  const projectId = c.req.param('projectId');
  const blockId = c.req.param('blockId');
  const user = c.get('user');

  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  if (!visibilityContext.visibleProjectIds.includes(projectId)) {
    throw new ApiError(403, 'escalations/access-denied', 'Access denied to this project');
  }

  const block = await getEscalationBlock(blockId, projectId);
  if (!block) {
    throw new ApiError(404, 'escalations/not-found', 'Escalation block not found');
  }

  return c.json({ data: block });
});

// Update escalation block
app.patch(
  '/projects/:projectId/escalation-blocks/:blockId',
  zValidator('json', updateEscalationBlockSchema),
  async (c) => {
    const projectId = c.req.param('projectId');
    const blockId = c.req.param('blockId');
    const user = c.get('user');
    const input = c.req.valid('json');

    const visibilityContext = await buildVisibilityContext(user.sub, user.org);
    if (!visibilityContext.visibleProjectIds.includes(projectId)) {
      throw new ApiError(403, 'escalations/access-denied', 'Access denied to this project');
    }

    const block = await updateEscalationBlock(blockId, projectId, input);
    if (!block) {
      throw new ApiError(404, 'escalations/not-found', 'Escalation block not found');
    }

    return c.json({ data: block });
  }
);

// Delete escalation block
app.delete('/projects/:projectId/escalation-blocks/:blockId', async (c) => {
  const projectId = c.req.param('projectId');
  const blockId = c.req.param('blockId');
  const user = c.get('user');

  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  if (!visibilityContext.visibleProjectIds.includes(projectId)) {
    throw new ApiError(403, 'escalations/access-denied', 'Access denied to this project');
  }

  const deleted = await deleteEscalationBlock(blockId, projectId);
  if (!deleted) {
    throw new ApiError(404, 'escalations/not-found', 'Escalation block not found');
  }

  return c.json({ data: { deleted: true } });
});

// =============================================================================
// Blocker Routes
// =============================================================================

// List blockers for project
app.get(
  '/projects/:projectId/blockers',
  zValidator('query', z.object({ status: z.string().optional() })),
  async (c) => {
    const projectId = c.req.param('projectId');
    const { status } = c.req.valid('query');
    const user = c.get('user');

    const visibilityContext = await buildVisibilityContext(user.sub, user.org);
    if (!visibilityContext.visibleProjectIds.includes(projectId)) {
      throw new ApiError(403, 'escalations/access-denied', 'Access denied to this project');
    }

    const blockers = await listBlockers(projectId, status);
    return c.json({ data: blockers });
  }
);

// Report a blocker
app.post('/projects/:projectId/blockers', zValidator('json', reportBlockerSchema), async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');
  const input = c.req.valid('json');

  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  if (!visibilityContext.visibleProjectIds.includes(projectId)) {
    throw new ApiError(403, 'escalations/access-denied', 'Access denied to this project');
  }

  const blocker = await reportBlocker(projectId, user.sub, input);
  return c.json({ data: blocker }, 201);
});

// Get blocker
app.get('/projects/:projectId/blockers/:blockerId', async (c) => {
  const projectId = c.req.param('projectId');
  const blockerId = c.req.param('blockerId');
  const user = c.get('user');

  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  if (!visibilityContext.visibleProjectIds.includes(projectId)) {
    throw new ApiError(403, 'escalations/access-denied', 'Access denied to this project');
  }

  const blocker = await getBlocker(blockerId, projectId);
  if (!blocker) {
    throw new ApiError(404, 'escalations/blocker-not-found', 'Blocker not found');
  }

  return c.json({ data: blocker });
});

// Resolve blocker (squad lead+)
app.post(
  '/projects/:projectId/blockers/:blockerId/resolve',
  zValidator('json', resolveBlockerSchema),
  async (c) => {
    const projectId = c.req.param('projectId');
    const blockerId = c.req.param('blockerId');
    const user = c.get('user');
    const input = c.req.valid('json');

    const visibilityContext = await buildVisibilityContext(user.sub, user.org);
    if (!visibilityContext.visibleProjectIds.includes(projectId)) {
      throw new ApiError(403, 'escalations/access-denied', 'Access denied to this project');
    }

    // TODO: Check if user is squad_lead or higher

    const blocker = await resolveBlocker(blockerId, projectId, user.sub, input);
    if (!blocker) {
      throw new ApiError(404, 'escalations/blocker-not-found', 'Blocker not found');
    }

    return c.json({ data: blocker });
  }
);

// =============================================================================
// Active Escalations
// =============================================================================

// Get active escalations for project
app.get('/projects/:projectId/escalations', async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');

  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  if (!visibilityContext.visibleProjectIds.includes(projectId)) {
    throw new ApiError(403, 'escalations/access-denied', 'Access denied to this project');
  }

  const escalations = await getActiveEscalations(projectId);
  return c.json({ data: escalations });
});

// Get my active escalations
app.get('/projects/:projectId/my-escalations', async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');

  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  if (!visibilityContext.visibleProjectIds.includes(projectId)) {
    throw new ApiError(403, 'escalations/access-denied', 'Access denied to this project');
  }

  const escalations = await getActiveEscalations(projectId, user.sub);
  return c.json({ data: escalations });
});

export default app;

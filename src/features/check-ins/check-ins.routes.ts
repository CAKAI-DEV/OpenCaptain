import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { ApiError } from '../../shared/middleware/error-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import { buildVisibilityContext } from '../visibility/visibility.service';
import {
  createCheckInBlock,
  deleteCheckInBlock,
  getCheckInBlock,
  listCheckInBlocks,
  updateCheckInBlock,
} from './check-ins.service';
import { getTemplate, getTemplateQuestions, listTemplates } from './check-ins.templates';
import { createCheckInBlockSchema, updateCheckInBlockSchema } from './check-ins.types';

const app = new Hono();

app.use('*', authMiddleware);
app.use('*', visibilityMiddleware);

// List available templates
app.get('/templates', async (c) => {
  const templates = listTemplates();
  return c.json({ data: templates });
});

// Get template details with questions
app.get('/templates/:templateId', async (c) => {
  const templateId = c.req.param('templateId');
  const template = getTemplate(templateId);

  if (!template) {
    throw new ApiError(404, 'check-ins/template-not-found', 'Template not found');
  }

  // Generate fresh question IDs
  const questions = getTemplateQuestions(templateId);

  return c.json({
    data: {
      id: template.id,
      name: template.name,
      description: template.description,
      defaultCron: template.defaultCron,
      questions,
    },
  });
});

// List check-in blocks for project
app.get('/projects/:projectId/check-in-blocks', async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');

  // Build visibility context to get visible project IDs
  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  const visibleProjectIds = visibilityContext.visibleProjectIds;

  if (!visibleProjectIds.includes(projectId)) {
    throw new ApiError(403, 'check-ins/access-denied', 'Access denied to this project');
  }

  const blocks = await listCheckInBlocks(projectId);
  return c.json({ data: blocks });
});

// Create check-in block (admin/pm only)
app.post(
  '/projects/:projectId/check-in-blocks',
  zValidator('json', createCheckInBlockSchema),
  async (c) => {
    const projectId = c.req.param('projectId');
    const user = c.get('user');
    const input = c.req.valid('json');

    // Build visibility context to get visible project IDs
    const visibilityContext = await buildVisibilityContext(user.sub, user.org);
    const visibleProjectIds = visibilityContext.visibleProjectIds;

    if (!visibleProjectIds.includes(projectId)) {
      throw new ApiError(403, 'check-ins/access-denied', 'Access denied to this project');
    }

    // TODO: Check if user is admin/pm for this project

    const block = await createCheckInBlock(projectId, user.sub, input);
    return c.json({ data: block }, 201);
  }
);

// Get check-in block
app.get('/projects/:projectId/check-in-blocks/:blockId', async (c) => {
  const projectId = c.req.param('projectId');
  const blockId = c.req.param('blockId');
  const user = c.get('user');

  // Build visibility context to get visible project IDs
  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  const visibleProjectIds = visibilityContext.visibleProjectIds;

  if (!visibleProjectIds.includes(projectId)) {
    throw new ApiError(403, 'check-ins/access-denied', 'Access denied to this project');
  }

  const block = await getCheckInBlock(blockId, projectId);
  if (!block) {
    throw new ApiError(404, 'check-ins/not-found', 'Check-in block not found');
  }

  return c.json({ data: block });
});

// Update check-in block
app.patch(
  '/projects/:projectId/check-in-blocks/:blockId',
  zValidator('json', updateCheckInBlockSchema),
  async (c) => {
    const projectId = c.req.param('projectId');
    const blockId = c.req.param('blockId');
    const user = c.get('user');
    const input = c.req.valid('json');

    // Build visibility context to get visible project IDs
    const visibilityContext = await buildVisibilityContext(user.sub, user.org);
    const visibleProjectIds = visibilityContext.visibleProjectIds;

    if (!visibleProjectIds.includes(projectId)) {
      throw new ApiError(403, 'check-ins/access-denied', 'Access denied to this project');
    }

    const block = await updateCheckInBlock(blockId, projectId, input);
    if (!block) {
      throw new ApiError(404, 'check-ins/not-found', 'Check-in block not found');
    }

    return c.json({ data: block });
  }
);

// Delete check-in block
app.delete('/projects/:projectId/check-in-blocks/:blockId', async (c) => {
  const projectId = c.req.param('projectId');
  const blockId = c.req.param('blockId');
  const user = c.get('user');

  // Build visibility context to get visible project IDs
  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  const visibleProjectIds = visibilityContext.visibleProjectIds;

  if (!visibleProjectIds.includes(projectId)) {
    throw new ApiError(403, 'check-ins/access-denied', 'Access denied to this project');
  }

  const deleted = await deleteCheckInBlock(blockId, projectId);
  if (!deleted) {
    throw new ApiError(404, 'check-ins/not-found', 'Check-in block not found');
  }

  return c.json({ data: { deleted: true } });
});

export default app;

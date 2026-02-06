import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, schema } from '../../shared/db';
import { ApiError } from '../../shared/middleware/error-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import { buildVisibilityContext } from '../visibility/visibility.service';
import { buildRecapContext, generateRecap } from './recaps.service';
import { generateRecapSchema } from './recaps.types';
import { queueRecap, scheduleRecurringRecaps } from './recaps.worker';

const recaps = new Hono();

// All routes require auth + visibility context
recaps.use('*', authMiddleware);
recaps.use('*', visibilityMiddleware);

// Generate recap on-demand
recaps.post('/generate', zValidator('json', generateRecapSchema), async (c) => {
  const user = c.get('user');
  const { projectId, period } = c.req.valid('json');

  // Verify project access
  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  if (!visibilityContext.visibleProjectIds.includes(projectId)) {
    throw new ApiError(
      403,
      'recaps/access-denied',
      'Access Denied',
      'Access denied to this project'
    );
  }

  const recap = await generateRecap(user.sub, projectId, user.org, period);
  return c.json({ data: { recap } });
});

// Get recap preview (context without LLM generation)
recaps.post('/preview', zValidator('json', generateRecapSchema), async (c) => {
  const user = c.get('user');
  const { projectId, period } = c.req.valid('json');

  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  if (!visibilityContext.visibleProjectIds.includes(projectId)) {
    throw new ApiError(
      403,
      'recaps/access-denied',
      'Access Denied',
      'Access denied to this project'
    );
  }

  const context = await buildRecapContext(user.sub, projectId, user.org, period);
  return c.json({ data: context });
});

// Queue recap for delivery (queues for current user)
recaps.post('/queue', zValidator('json', generateRecapSchema), async (c) => {
  const user = c.get('user');
  const { projectId, period } = c.req.valid('json');

  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  if (!visibilityContext.visibleProjectIds.includes(projectId)) {
    throw new ApiError(
      403,
      'recaps/access-denied',
      'Access Denied',
      'Access denied to this project'
    );
  }

  await queueRecap(user.sub, projectId, user.org, period);
  return c.json({ data: { queued: true } });
});

// Enable recurring recaps for a project
recaps.post('/projects/:projectId/enable-recurring', async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');

  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  if (!visibilityContext.visibleProjectIds.includes(projectId)) {
    throw new ApiError(
      403,
      'recaps/access-denied',
      'Access Denied',
      'Access denied to this project'
    );
  }

  // Get project's organization
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
    columns: { orgId: true },
  });

  if (!project) {
    throw new ApiError(404, 'recaps/project-not-found', 'Project Not Found', 'Project not found');
  }

  await scheduleRecurringRecaps(projectId, project.orgId);
  return c.json({ data: { enabled: true } });
});

export { recaps as recapsRoutes };

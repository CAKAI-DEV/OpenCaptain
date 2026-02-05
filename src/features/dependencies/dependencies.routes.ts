import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import {
  createDependency,
  deleteDependency,
  getDependenciesFor,
  isBlocked,
} from './dependencies.service';
import type { DependencyNode } from './dependencies.types';

const dependencyNodeSchema = z.object({
  type: z.enum(['task', 'deliverable']),
  id: z.string().uuid(),
});

const createDependencySchema = z.object({
  blocker: dependencyNodeSchema,
  blocked: dependencyNodeSchema,
});

const getDependenciesQuerySchema = z.object({
  direction: z.enum(['blocks', 'blocked_by']).default('blocks'),
});

export const dependenciesRoutes = new Hono();

// Apply middleware to all routes
dependenciesRoutes.use('*', authMiddleware);
dependenciesRoutes.use('*', visibilityMiddleware);

/**
 * POST / - Create a new dependency
 * Body: { blocker: { type, id }, blocked: { type, id } }
 * Returns 201 on success, 400 if cycle detected
 */
dependenciesRoutes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const input = createDependencySchema.parse(body);

  const dependency = await createDependency(
    {
      blocker: input.blocker as DependencyNode,
      blocked: input.blocked as DependencyNode,
    },
    user.sub
  );

  return c.json({ data: dependency }, 201);
});

/**
 * DELETE /:dependencyId - Delete a dependency
 * Returns 204 on success
 */
dependenciesRoutes.delete('/:dependencyId', async (c) => {
  const dependencyId = c.req.param('dependencyId');

  await deleteDependency(dependencyId);

  return c.body(null, 204);
});

/**
 * GET /for/:type/:itemId - Get dependencies for an item
 * Query: direction ('blocks' | 'blocked_by')
 * Returns array of dependencies with item details
 */
dependenciesRoutes.get('/for/:type/:itemId', async (c) => {
  const type = c.req.param('type') as 'task' | 'deliverable';
  const itemId = c.req.param('itemId');
  const query = c.req.query();

  const parsed = getDependenciesQuerySchema.safeParse(query);
  const direction = parsed.success ? parsed.data.direction : 'blocks';

  // Validate type
  if (type !== 'task' && type !== 'deliverable') {
    return c.json(
      {
        type: 'https://blockbot.dev/errors/dependencies/invalid-type',
        title: 'Invalid Item Type',
        status: 400,
        detail: 'Type must be "task" or "deliverable"',
      },
      400
    );
  }

  const dependencies = await getDependenciesFor({ type, id: itemId }, direction);

  return c.json({ data: dependencies });
});

/**
 * GET /blocked/:type/:itemId - Check if an item is blocked
 * Returns { blocked: boolean, blockedBy: DependencyNode[] }
 */
dependenciesRoutes.get('/blocked/:type/:itemId', async (c) => {
  const type = c.req.param('type') as 'task' | 'deliverable';
  const itemId = c.req.param('itemId');

  // Validate type
  if (type !== 'task' && type !== 'deliverable') {
    return c.json(
      {
        type: 'https://blockbot.dev/errors/dependencies/invalid-type',
        title: 'Invalid Item Type',
        status: 400,
        detail: 'Type must be "task" or "deliverable"',
      },
      400
    );
  }

  const status = await isBlocked({ type, id: itemId });

  return c.json({ data: status });
});

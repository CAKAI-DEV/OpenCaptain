import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { hasCapability } from '../../shared/lib/permissions';
import { ApiError } from '../../shared/middleware/error-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from './visibility.middleware';
import {
  buildVisibilityContext,
  getVisibilityGrantsWithSquads,
  grantVisibility,
  revokeVisibility,
} from './visibility.service';

const visibility = new Hono();

// Validation schemas
const grantVisibilitySchema = z.object({
  granteeUserId: z.string().uuid(),
  squadId: z.string().uuid(),
  expiresAt: z.string().datetime().optional(),
});

const revokeVisibilitySchema = z.object({
  granteeUserId: z.string().uuid(),
  squadId: z.string().uuid(),
});

// All routes require authentication
visibility.use('*', authMiddleware);
visibility.use('*', visibilityMiddleware);

// POST /api/v1/visibility/grants - Grant cross-squad visibility (auth required, must be admin/pm)
visibility.post('/grants', zValidator('json', grantVisibilitySchema), async (c) => {
  const user = c.get('user');
  const userContext = c.get('userContext');
  const { granteeUserId, squadId, expiresAt } = c.req.valid('json');

  // Check if user has permission to grant visibility
  const canGrant =
    userContext.projectRoles.some((pr) => pr.role === 'admin') ||
    userContext.projectRoles.some((pr) => hasCapability(pr.role, 'grant_visibility'));

  if (!canGrant) {
    throw new ApiError(
      403,
      'visibility/unauthorized',
      'Unauthorized',
      'You do not have permission to grant visibility'
    );
  }

  const grant = await grantVisibility({
    granteeUserId,
    squadId,
    grantedById: user.sub,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  });

  return c.json(grant, 201);
});

// DELETE /api/v1/visibility/grants - Revoke visibility (auth required, must be admin/pm)
visibility.delete('/grants', zValidator('json', revokeVisibilitySchema), async (c) => {
  const userContext = c.get('userContext');
  const { granteeUserId, squadId } = c.req.valid('json');

  // Check if user has permission to revoke visibility
  const canRevoke =
    userContext.projectRoles.some((pr) => pr.role === 'admin') ||
    userContext.projectRoles.some((pr) => hasCapability(pr.role, 'grant_visibility'));

  if (!canRevoke) {
    throw new ApiError(
      403,
      'visibility/unauthorized',
      'Unauthorized',
      'You do not have permission to revoke visibility'
    );
  }

  await revokeVisibility(granteeUserId, squadId);
  return c.body(null, 204);
});

// GET /api/v1/visibility/grants/:userId - Get user's visibility grants (auth required)
visibility.get('/grants/:userId', async (c) => {
  const userId = c.req.param('userId');
  const grants = await getVisibilityGrantsWithSquads(userId);
  return c.json(grants);
});

// GET /api/v1/visibility/context - Get current user's visibility context (auth required)
visibility.get('/context', async (c) => {
  const user = c.get('user');
  const context = await buildVisibilityContext(user.sub, user.org);
  return c.json(context);
});

export { visibility as visibilityRoutes };

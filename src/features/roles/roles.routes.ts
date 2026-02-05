import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import { assignRole, getProjectMembers, getUserRoles, removeFromProject } from './roles.service';

const roles = new Hono();

// Validation schemas
const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'pm', 'squad_lead', 'member']),
  reportsToUserId: z.string().uuid().optional(),
});

// All routes require authentication and visibility
roles.use('*', authMiddleware);
roles.use('*', visibilityMiddleware);

// POST /api/v1/projects/:projectId/members - Assign role to user
roles.post('/projects/:projectId/members', zValidator('json', assignRoleSchema), async (c) => {
  const projectId = c.req.param('projectId');
  const { userId, role, reportsToUserId } = c.req.valid('json');

  const member = await assignRole({
    projectId,
    userId,
    role,
    reportsToUserId,
  });

  return c.json(member, 201);
});

// DELETE /api/v1/projects/:projectId/members/:userId - Remove from project
roles.delete('/projects/:projectId/members/:userId', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.req.param('userId');

  await removeFromProject(projectId, userId);
  return c.json({ message: 'Member removed from project successfully' });
});

// GET /api/v1/projects/:projectId/members - List project members
roles.get('/projects/:projectId/members', async (c) => {
  const projectId = c.req.param('projectId');
  const members = await getProjectMembers(projectId);
  return c.json(members);
});

// GET /api/v1/users/:userId/roles - Get user's roles across projects
roles.get('/users/:userId/roles', async (c) => {
  const userId = c.req.param('userId');
  const userRoles = await getUserRoles(userId);
  return c.json(userRoles);
});

export { roles as rolesRoutes };

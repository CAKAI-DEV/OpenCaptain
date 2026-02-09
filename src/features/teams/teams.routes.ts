import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import {
  addSquadMember,
  createSquad,
  deleteSquad,
  getSquad,
  getSquadMembers,
  removeSquadMember,
  updateSquad,
} from './teams.service';

const teams = new Hono();

// Validation schemas
const createSquadSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  parentSquadId: z.string().uuid().optional(),
  leadUserId: z.string().uuid().optional(),
});

const updateSquadSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  leadUserId: z.string().uuid().nullable().optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
});

// All routes require authentication and visibility
teams.use('*', authMiddleware);
teams.use('*', visibilityMiddleware);

// POST /api/v1/squads - Create squad
teams.post('/', zValidator('json', createSquadSchema), async (c) => {
  const input = c.req.valid('json');
  const squad = await createSquad(input);
  return c.json(squad, 201);
});

// GET /api/v1/squads/:id - Get single squad
teams.get('/:id', async (c) => {
  const id = c.req.param('id');
  const visibleSquadIds = c.get('visibleSquadIds');

  // If visibleSquadIds is non-empty array, user is restricted - check access
  if (visibleSquadIds && visibleSquadIds.length > 0 && !visibleSquadIds.includes(id)) {
    return c.json(
      {
        type: 'https://blockbot.dev/errors/squads/access-denied',
        title: 'Access Denied',
        status: 403,
        detail: 'You do not have visibility access to this squad',
        instance: c.req.path,
      },
      403
    );
  }

  const squad = await getSquad(id);

  if (!squad) {
    return c.json(
      {
        type: 'https://blockbot.dev/errors/squads/not-found',
        title: 'Squad Not Found',
        status: 404,
        detail: 'The specified squad does not exist',
        instance: c.req.path,
      },
      404
    );
  }

  return c.json(squad);
});

// PATCH /api/v1/squads/:id - Update squad
teams.patch('/:id', zValidator('json', updateSquadSchema), async (c) => {
  const id = c.req.param('id');
  const updates = c.req.valid('json');
  const squad = await updateSquad(id, updates);
  return c.json(squad);
});

// DELETE /api/v1/squads/:id - Delete squad
teams.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await deleteSquad(id);
  return c.json({ message: 'Squad deleted successfully' });
});

// POST /api/v1/squads/:id/members - Add member
teams.post('/:id/members', zValidator('json', addMemberSchema), async (c) => {
  const squadId = c.req.param('id');
  const { userId } = c.req.valid('json');
  const member = await addSquadMember({ squadId, userId });
  return c.json(member, 201);
});

// DELETE /api/v1/squads/:id/members/:userId - Remove member
teams.delete('/:id/members/:userId', async (c) => {
  const squadId = c.req.param('id');
  const userId = c.req.param('userId');
  await removeSquadMember(squadId, userId);
  return c.json({ message: 'Member removed successfully' });
});

// GET /api/v1/squads/:id/members - List members
teams.get('/:id/members', async (c) => {
  const squadId = c.req.param('id');
  const visibleSquadIds = c.get('visibleSquadIds');

  // If visibleSquadIds is non-empty array, user is restricted - check access
  if (visibleSquadIds && visibleSquadIds.length > 0 && !visibleSquadIds.includes(squadId)) {
    return c.json(
      {
        type: 'https://blockbot.dev/errors/squads/access-denied',
        title: 'Access Denied',
        status: 403,
        detail: 'You do not have visibility access to this squad',
        instance: c.req.path,
      },
      403
    );
  }

  const members = await getSquadMembers(squadId);
  return c.json(members);
});

export { teams as teamsRoutes };

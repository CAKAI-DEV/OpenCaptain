import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../../shared/middleware/error-handler';
import { authMiddleware } from '../auth/auth.middleware';
import {
  acceptInvitation,
  acceptInviteLink,
  createEmailInvitation,
  createShareableLink,
} from './invitations.service';

const invitations = new Hono();

// Validation schemas
const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.string().max(50).optional(),
});

const createLinkSchema = z.object({
  role: z.string().max(50).optional(),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

// POST /invitations - Create email invitation (auth required)
invitations.post('/', authMiddleware, zValidator('json', createInvitationSchema), async (c) => {
  const { email, role } = c.req.valid('json');
  const user = c.get('user');

  const result = await createEmailInvitation({
    orgId: user.org,
    email,
    invitedById: user.sub,
    role,
  });

  return c.json(result, 201);
});

// POST /invite-links - Create shareable link (auth required)
invitations.post('/links', authMiddleware, zValidator('json', createLinkSchema), async (c) => {
  const { role } = c.req.valid('json');
  const user = c.get('user');

  const result = await createShareableLink({
    orgId: user.org,
    createdById: user.sub,
    role,
  });

  return c.json(result, 201);
});

// POST /accept - Accept invitation or invite link (auth required)
invitations.post(
  '/accept',
  authMiddleware,
  zValidator('json', acceptInvitationSchema),
  async (c) => {
    const { token } = c.req.valid('json');
    const user = c.get('user');

    // Try email invitation first, then shareable link
    let result = await acceptInvitation(token, user.sub);

    if (!result.success) {
      // Try as invite link
      result = await acceptInviteLink(token, user.sub);
    }

    if (!result.success) {
      throw new ApiError(
        400,
        'invitations/invalid-token',
        'Invalid Invitation',
        'The invitation token is invalid or has expired'
      );
    }

    return c.json({ success: true, orgId: result.orgId });
  }
);

export { invitations as invitationRoutes };

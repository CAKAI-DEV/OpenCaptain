import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, schema } from '../../db/index.ts';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { generateMagicLinkToken, generateTokens } from '../../services/auth.ts';
import { sendMagicLink } from '../../services/email.ts';
import { ApiError } from '../../middleware/error-handler.ts';

const app = new Hono();

const requestSchema = z.object({
  email: z.string().email(),
});

// Request magic link
app.post('/request', zValidator('json', requestSchema), async (c) => {
  const { email } = c.req.valid('json');

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return c.json({ message: 'If an account exists, a magic link has been sent' });
  }

  const token = generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(schema.magicLinks).values({
    userId: user.id,
    token,
    expiresAt,
  });

  await sendMagicLink(email, token);

  return c.json({ message: 'If an account exists, a magic link has been sent' });
});

// Verify magic link
app.get('/verify', async (c) => {
  const token = c.req.query('token');

  if (!token) {
    throw new ApiError(400, 'auth/missing-token', 'Missing Token', 'Magic link token is required');
  }

  const magicLink = await db.query.magicLinks.findFirst({
    where: and(
      eq(schema.magicLinks.token, token),
      gt(schema.magicLinks.expiresAt, new Date()),
      isNull(schema.magicLinks.usedAt)
    ),
  });

  if (!magicLink) {
    throw new ApiError(401, 'auth/invalid-magic-link', 'Invalid Magic Link', 'This magic link is invalid or has expired');
  }

  // Mark as used
  await db.update(schema.magicLinks)
    .set({ usedAt: new Date() })
    .where(eq(schema.magicLinks.id, magicLink.id));

  // Mark email as verified
  await db.update(schema.users)
    .set({ emailVerified: true })
    .where(eq(schema.users.id, magicLink.userId));

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, magicLink.userId),
  });

  if (!user) {
    throw new ApiError(500, 'auth/user-not-found', 'User Not Found', 'User associated with magic link not found');
  }

  const tokens = await generateTokens({ id: user.id, orgId: user.orgId, email: user.email });

  return c.json({
    user: { id: user.id, email: user.email, orgId: user.orgId },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

export default app;

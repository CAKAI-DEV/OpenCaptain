import { zValidator } from '@hono/zod-validator';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../../shared/db';
import { ApiError } from '../../shared/middleware/error-handler';
import { sendMagicLink } from './auth.email';
import { authMiddleware } from './auth.middleware';
import {
  generateMagicLinkToken,
  generateTokens,
  hashPassword,
  MAGIC_LINK_EXPIRY,
  revokeAllRefreshTokens,
  verifyPassword,
  verifyRefreshToken,
} from './auth.service';

const auth = new Hono();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  orgName: z.string().min(1).max(255),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const magicLinkRequestSchema = z.object({
  email: z.string().email(),
});

// POST /register
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, orgName } = c.req.valid('json');

  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  if (existingUser) {
    throw new ApiError(
      409,
      'auth/email-exists',
      'Email Already Registered',
      'An account with this email already exists'
    );
  }

  const passwordHash = await hashPassword(password);

  const orgs = await db.insert(schema.organizations).values({ name: orgName }).returning();
  const org = orgs[0];
  if (!org) {
    throw new ApiError(
      500,
      'auth/org-creation-failed',
      'Organization Creation Failed',
      'Failed to create organization'
    );
  }

  const users = await db
    .insert(schema.users)
    .values({
      orgId: org.id,
      email,
      passwordHash,
      emailVerified: false,
    })
    .returning();
  const user = users[0];
  if (!user) {
    throw new ApiError(
      500,
      'auth/user-creation-failed',
      'User Creation Failed',
      'Failed to create user'
    );
  }

  const tokens = await generateTokens({ id: user.id, orgId: org.id, email: user.email });

  return c.json(
    {
      user: { id: user.id, email: user.email, orgId: org.id },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
    201
  );
});

// POST /login
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  if (!user || !user.passwordHash) {
    throw new ApiError(
      401,
      'auth/invalid-credentials',
      'Invalid Credentials',
      'Email or password is incorrect'
    );
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    throw new ApiError(
      401,
      'auth/invalid-credentials',
      'Invalid Credentials',
      'Email or password is incorrect'
    );
  }

  const tokens = await generateTokens({ id: user.id, orgId: user.orgId, email: user.email });

  return c.json({
    user: { id: user.id, email: user.email, orgId: user.orgId },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

// POST /refresh
auth.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');

  const result = await verifyRefreshToken(refreshToken);
  if (!result) {
    throw new ApiError(
      401,
      'auth/invalid-refresh-token',
      'Invalid Refresh Token',
      'The refresh token is invalid or has been revoked'
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, result.userId),
  });

  if (!user) {
    throw new ApiError(
      401,
      'auth/user-not-found',
      'User Not Found',
      'User associated with token not found'
    );
  }

  const tokens = await generateTokens({ id: user.id, orgId: user.orgId, email: user.email });

  return c.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

// POST /logout
auth.post('/logout', authMiddleware, async (c) => {
  const user = c.get('user');
  await revokeAllRefreshTokens(user.sub);
  return c.json({ message: 'Logged out successfully' });
});

// POST /magic-link/request
auth.post('/magic-link/request', zValidator('json', magicLinkRequestSchema), async (c) => {
  const { email } = c.req.valid('json');

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return c.json({ message: 'If an account exists, a magic link has been sent' });
  }

  const token = generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY);

  await db.insert(schema.magicLinks).values({
    userId: user.id,
    token,
    expiresAt,
  });

  await sendMagicLink(email, token);

  return c.json({ message: 'If an account exists, a magic link has been sent' });
});

// GET /magic-link/verify
auth.get('/magic-link/verify', async (c) => {
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
    throw new ApiError(
      401,
      'auth/invalid-magic-link',
      'Invalid Magic Link',
      'This magic link is invalid or has expired'
    );
  }

  await db
    .update(schema.magicLinks)
    .set({ usedAt: new Date() })
    .where(eq(schema.magicLinks.id, magicLink.id));

  await db
    .update(schema.users)
    .set({ emailVerified: true })
    .where(eq(schema.users.id, magicLink.userId));

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, magicLink.userId),
  });

  if (!user) {
    throw new ApiError(
      500,
      'auth/user-not-found',
      'User Not Found',
      'User associated with magic link not found'
    );
  }

  const tokens = await generateTokens({ id: user.id, orgId: user.orgId, email: user.email });

  return c.json({
    user: { id: user.id, email: user.email, orgId: user.orgId },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

export { auth as authRoutes };

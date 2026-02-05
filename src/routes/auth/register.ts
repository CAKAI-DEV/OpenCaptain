import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, schema } from '../../db/index.ts';
import { eq } from 'drizzle-orm';
import { hashPassword, generateTokens } from '../../services/auth.ts';
import { ApiError } from '../../middleware/error-handler.ts';

const app = new Hono();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  orgName: z.string().min(1).max(255),
});

app.post('/', zValidator('json', registerSchema), async (c) => {
  const { email, password, orgName } = c.req.valid('json');

  // Check if email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  if (existingUser) {
    throw new ApiError(409, 'auth/email-exists', 'Email Already Registered', 'An account with this email already exists');
  }

  // Create organization and user
  const passwordHash = await hashPassword(password);

  const orgs = await db.insert(schema.organizations).values({ name: orgName }).returning();
  const org = orgs[0];
  if (!org) {
    throw new ApiError(500, 'auth/org-creation-failed', 'Organization Creation Failed', 'Failed to create organization');
  }

  const users = await db.insert(schema.users).values({
    orgId: org.id,
    email,
    passwordHash,
    emailVerified: false,
  }).returning();
  const user = users[0];
  if (!user) {
    throw new ApiError(500, 'auth/user-creation-failed', 'User Creation Failed', 'Failed to create user');
  }

  const tokens = await generateTokens({ id: user.id, orgId: org.id, email: user.email });

  return c.json({
    user: { id: user.id, email: user.email, orgId: org.id },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  }, 201);
});

export default app;

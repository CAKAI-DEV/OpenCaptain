import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, schema } from '../../db/index.ts';
import { eq } from 'drizzle-orm';
import { verifyPassword, generateTokens } from '../../services/auth.ts';
import { ApiError } from '../../middleware/error-handler.ts';

const app = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

app.post('/', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  if (!user || !user.passwordHash) {
    throw new ApiError(401, 'auth/invalid-credentials', 'Invalid Credentials', 'Email or password is incorrect');
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    throw new ApiError(401, 'auth/invalid-credentials', 'Invalid Credentials', 'Email or password is incorrect');
  }

  const tokens = await generateTokens({ id: user.id, orgId: user.orgId, email: user.email });

  return c.json({
    user: { id: user.id, email: user.email, orgId: user.orgId },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

export default app;

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, schema } from '../../db/index.ts';
import { eq } from 'drizzle-orm';
import { verifyRefreshToken, generateTokens } from '../../services/auth.ts';
import { ApiError } from '../../middleware/error-handler.ts';

const app = new Hono();

const refreshSchema = z.object({
  refreshToken: z.string(),
});

app.post('/', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');

  const result = await verifyRefreshToken(refreshToken);
  if (!result) {
    throw new ApiError(401, 'auth/invalid-refresh-token', 'Invalid Refresh Token', 'The refresh token is invalid or has been revoked');
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, result.userId),
  });

  if (!user) {
    throw new ApiError(401, 'auth/user-not-found', 'User Not Found', 'User associated with token not found');
  }

  const tokens = await generateTokens({ id: user.id, orgId: user.orgId, email: user.email });

  return c.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

export default app;

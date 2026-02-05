import { Hono } from 'hono';
import { revokeAllRefreshTokens } from '../../services/auth.ts';
import { authMiddleware } from '../../middleware/auth.ts';

const app = new Hono();

app.post('/', authMiddleware, async (c) => {
  const user = c.get('user');
  await revokeAllRefreshTokens(user.sub);
  return c.json({ message: 'Logged out successfully' });
});

export default app;

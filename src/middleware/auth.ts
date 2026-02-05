import type { Context, Next } from 'hono';
import { verifyAccessToken, type TokenPayload } from '../services/auth.ts';
import { ApiError } from './error-handler.ts';

declare module 'hono' {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'auth/missing-token', 'Missing Authentication Token', 'Authorization header with Bearer token is required');
  }

  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token);

  if (!payload) {
    throw new ApiError(401, 'auth/invalid-token', 'Invalid Authentication Token', 'The provided access token is invalid or expired');
  }

  c.set('user', payload);
  await next();
}

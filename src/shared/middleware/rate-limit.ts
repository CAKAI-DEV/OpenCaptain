import type { Context, Next } from 'hono';
import { logger } from '../lib/logger';
import { checkRateLimit } from '../lib/redis';
import { ApiError } from './error-handler';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyPrefix: 'ratelimit',
};

export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const { windowMs, maxRequests, keyPrefix } = { ...DEFAULT_CONFIG, ...config };

  return async function rateLimitMiddleware(c: Context, next: Next) {
    const user = c.get('user');
    const identifier = user?.sub || c.req.header('x-forwarded-for') || 'anonymous';

    const key = `${keyPrefix}:${identifier}`;

    const result = await checkRateLimit(key, windowMs, maxRequests);

    if (!result.success || !result.data) {
      logger.error({ error: result.error, key }, 'Rate limiter Redis error, allowing request');
      await next();
      return;
    }

    const { allowed, remaining, limit, resetAt } = result.data;

    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', resetAt.toString());

    if (!allowed) {
      throw new ApiError(
        429,
        'rate-limit/exceeded',
        'Rate Limit Exceeded',
        `Too many requests. Please try again in ${Math.ceil(windowMs / 1000)} seconds.`
      );
    }

    await next();
  };
}

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyPrefix: 'ratelimit:api',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'ratelimit:auth',
});

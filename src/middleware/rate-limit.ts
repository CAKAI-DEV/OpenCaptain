import type { Context, Next } from 'hono';
import { redis } from '../lib/redis.ts';
import { ApiError } from './error-handler.ts';
import { logger } from '../lib/logger.ts';

interface RateLimitConfig {
  windowMs: number;     // Window size in milliseconds
  maxRequests: number;  // Max requests per window
  keyPrefix: string;    // Redis key prefix
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 100,        // 100 requests per minute
  keyPrefix: 'ratelimit',
};

// Lua script for atomic rate limiting with sliding window
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

-- Remove old entries outside the window
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

-- Count current entries
local count = redis.call('ZCARD', key)

if count >= limit then
  return {0, count, limit}
end

-- Add current request
redis.call('ZADD', key, now, now .. '-' .. math.random())

-- Set expiry on key
redis.call('PEXPIRE', key, window)

return {1, count + 1, limit}
`;

export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const { windowMs, maxRequests, keyPrefix } = { ...DEFAULT_CONFIG, ...config };

  return async function rateLimitMiddleware(c: Context, next: Next) {
    // Get identifier: user ID if authenticated, IP otherwise
    const user = c.get('user');
    const identifier = user?.sub || c.req.header('x-forwarded-for') || 'anonymous';

    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();

    try {
      const result = await redis.eval(SLIDING_WINDOW_SCRIPT, {
        keys: [key],
        arguments: [now.toString(), windowMs.toString(), maxRequests.toString()],
      }) as [number, number, number];

      const [allowed, current, limit] = result;

      // Set rate limit headers
      c.header('X-RateLimit-Limit', limit.toString());
      c.header('X-RateLimit-Remaining', Math.max(0, limit - current).toString());
      c.header('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000).toString());

      if (!allowed) {
        throw new ApiError(
          429,
          'rate-limit/exceeded',
          'Rate Limit Exceeded',
          `Too many requests. Please try again in ${Math.ceil(windowMs / 1000)} seconds.`
        );
      }

      await next();
    } catch (err) {
      if (err instanceof ApiError) throw err;

      // If Redis fails, log and allow request (fail open for availability)
      logger.error({ err, key }, 'Rate limiter Redis error, allowing request');
      await next();
    }
  };
}

// Pre-configured rate limiters
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,   // 1 minute
  maxRequests: 100,       // 100 requests/min per user
  keyPrefix: 'ratelimit:api',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,           // 10 attempts per 15 min
  keyPrefix: 'ratelimit:auth',
});

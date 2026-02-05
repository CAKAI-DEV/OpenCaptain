import { createClient } from 'redis';
import { env } from './env.ts';
import { logger } from './logger.ts';

export const redis = createClient({ url: env.REDIS_URL });

redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));
redis.on('connect', () => logger.info('Redis connected'));

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
  return redis;
}

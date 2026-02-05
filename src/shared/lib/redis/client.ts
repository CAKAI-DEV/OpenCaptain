import { createClient, type RedisClientType } from 'redis';
import { env } from '../env';
import { logger } from '../logger';

let client: RedisClientType | null = null;

export function getRedisClient(): RedisClientType {
  if (!client) {
    client = createClient({ url: env.REDIS_URL });

    client.on('error', (err) => logger.error({ err }, 'Redis connection error'));
    client.on('connect', () => logger.info('Redis connected'));
    client.on('reconnecting', () => logger.warn('Redis reconnecting'));
    client.on('end', () => logger.info('Redis connection closed'));
  }

  return client;
}

export async function connectRedis(): Promise<RedisClientType> {
  const redis = getRedisClient();

  if (!redis.isOpen) {
    await redis.connect();
  }

  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
  }
}

export function isRedisConnected(): boolean {
  return client?.isOpen ?? false;
}

import { logger } from '../logger';
import { getRedisClient } from './client';
import type { RateLimitResult, RedisResult } from './types';

// Wrap Redis operations with consistent error handling
async function wrapOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<RedisResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (err) {
    logger.error({ err, operation: operationName }, 'Redis operation failed');
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// Key-Value Operations
export async function getValue<T>(key: string): Promise<RedisResult<T>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    const value = await redis.get(key);
    if (value === null) {
      return undefined as T;
    }
    return JSON.parse(value) as T;
  }, 'getValue');
}

export async function setValue<T>(
  key: string,
  value: T,
  ttlMs?: number
): Promise<RedisResult<void>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    const serialized = JSON.stringify(value);

    if (ttlMs) {
      await redis.set(key, serialized, { PX: ttlMs });
    } else {
      await redis.set(key, serialized);
    }
  }, 'setValue');
}

export async function deleteKey(key: string): Promise<RedisResult<void>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    await redis.del(key);
  }, 'deleteKey');
}

export async function deleteKeys(keys: string[]): Promise<RedisResult<number>> {
  if (keys.length === 0) {
    return { success: true, data: 0 };
  }

  return wrapOperation(async () => {
    const redis = getRedisClient();
    return redis.del(keys);
  }, 'deleteKeys');
}

export async function keyExists(key: string): Promise<RedisResult<boolean>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    const count = await redis.exists(key);
    return count > 0;
  }, 'keyExists');
}

export async function findKeys(pattern: string): Promise<RedisResult<string[]>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    return redis.keys(pattern);
  }, 'findKeys');
}

// TTL Operations
export async function setExpiry(key: string, ttlMs: number): Promise<RedisResult<boolean>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    const result = await redis.pExpire(key, ttlMs);
    return result === 1;
  }, 'setExpiry');
}

export async function getTtl(key: string): Promise<RedisResult<number>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    return redis.pTTL(key);
  }, 'getTtl');
}

// Increment/Decrement
export async function increment(key: string, by = 1): Promise<RedisResult<number>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    return redis.incrBy(key, by);
  }, 'increment');
}

export async function decrement(key: string, by = 1): Promise<RedisResult<number>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    return redis.decrBy(key, by);
  }, 'decrement');
}

// Hash Operations
export async function hashGet<T>(key: string, field: string): Promise<RedisResult<T>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    const value = await redis.hGet(key, field);
    if (value === undefined || value === null) {
      return undefined as T;
    }
    return JSON.parse(value) as T;
  }, 'hashGet');
}

export async function hashSet<T>(key: string, field: string, value: T): Promise<RedisResult<void>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    await redis.hSet(key, field, JSON.stringify(value));
  }, 'hashSet');
}

export async function hashDelete(key: string, ...fields: string[]): Promise<RedisResult<number>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    return redis.hDel(key, fields);
  }, 'hashDelete');
}

export async function hashGetAll<T>(key: string): Promise<RedisResult<Record<string, T>>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    const raw = await redis.hGetAll(key);
    const result: Record<string, T> = {};

    for (const [field, value] of Object.entries(raw)) {
      result[field] = JSON.parse(value) as T;
    }

    return result;
  }, 'hashGetAll');
}

// Set Operations
export async function setAdd(key: string, ...members: string[]): Promise<RedisResult<number>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    return redis.sAdd(key, members);
  }, 'setAdd');
}

export async function setRemove(key: string, ...members: string[]): Promise<RedisResult<number>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    return redis.sRem(key, members);
  }, 'setRemove');
}

export async function setMembers(key: string): Promise<RedisResult<string[]>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    return redis.sMembers(key);
  }, 'setMembers');
}

export async function setIsMember(key: string, member: string): Promise<RedisResult<boolean>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    const result = await redis.sIsMember(key, member);
    return Boolean(result);
  }, 'setIsMember');
}

// Rate Limiting (Sliding Window)
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

local count = redis.call('ZCARD', key)

if count >= limit then
  return {0, count, limit}
end

redis.call('ZADD', key, now, now .. '-' .. math.random())
redis.call('PEXPIRE', key, window)

return {1, count + 1, limit}
`;

export async function checkRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<RedisResult<RateLimitResult>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    const now = Date.now();

    const result = (await redis.eval(SLIDING_WINDOW_SCRIPT, {
      keys: [key],
      arguments: [now.toString(), windowMs.toString(), maxRequests.toString()],
    })) as [number, number, number];

    const [allowed, current, limit] = result;

    return {
      allowed: allowed === 1,
      current,
      limit,
      remaining: Math.max(0, limit - current),
      resetAt: Math.ceil((now + windowMs) / 1000),
    };
  }, 'checkRateLimit');
}

// Health Check
export async function ping(): Promise<RedisResult<string>> {
  return wrapOperation(async () => {
    const redis = getRedisClient();
    return redis.ping();
  }, 'ping');
}

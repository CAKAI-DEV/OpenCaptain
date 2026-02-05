// Redis response types
export interface RedisResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Cache entry with TTL tracking
export interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

// Rate limit result from Lua script
export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetAt: number;
}

// Generic key-value operations
export interface KeyValueOps {
  get<T>(key: string): Promise<RedisResult<T>>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<RedisResult<void>>;
  del(key: string): Promise<RedisResult<void>>;
  exists(key: string): Promise<RedisResult<boolean>>;
}

// Set operations
export interface SetOps {
  sadd(key: string, ...members: string[]): Promise<RedisResult<number>>;
  srem(key: string, ...members: string[]): Promise<RedisResult<number>>;
  smembers(key: string): Promise<RedisResult<string[]>>;
  sismember(key: string, member: string): Promise<RedisResult<boolean>>;
}

// Sorted set operations (for rate limiting)
export interface SortedSetOps {
  zadd(key: string, score: number, member: string): Promise<RedisResult<number>>;
  zremrangebyscore(key: string, min: number, max: number): Promise<RedisResult<number>>;
  zcard(key: string): Promise<RedisResult<number>>;
}

// Hash operations
export interface HashOps {
  hget<T>(key: string, field: string): Promise<RedisResult<T>>;
  hset<T>(key: string, field: string, value: T): Promise<RedisResult<void>>;
  hdel(key: string, ...fields: string[]): Promise<RedisResult<number>>;
  hgetall<T>(key: string): Promise<RedisResult<Record<string, T>>>;
}

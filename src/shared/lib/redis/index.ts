// Client management
export { connectRedis, disconnectRedis, getRedisClient, isRedisConnected } from './client';
// Operations
export {
  // Rate Limiting
  checkRateLimit,
  decrement,
  deleteKey,
  deleteKeys,
  // Pending Task Confirmation
  deletePendingTaskConfirmation,
  findKeys,
  getPendingTaskConfirmation,
  getTtl,
  // Key-Value
  getValue,
  hashDelete,
  // Hash
  hashGet,
  hashGetAll,
  hashSet,
  // Increment/Decrement
  increment,
  keyExists,
  // Health
  ping,
  // Set
  setAdd,
  // TTL
  setExpiry,
  setIsMember,
  setMembers,
  setPendingTaskConfirmation,
  setRemove,
  setValue,
} from './operations';
// Types
export type { CacheEntry, RateLimitResult, RedisResult } from './types';

import { afterAll, afterEach, beforeAll } from 'bun:test';
import { db, schema } from '../shared/db';
import { connectRedis, deleteKeys, disconnectRedis, findKeys } from '../shared/lib/redis';

// Connect to test database before all tests
beforeAll(async () => {
  await connectRedis();
});

// Clean up database after each test
afterEach(async () => {
  // Clear all tables in reverse order of dependencies
  await db.delete(schema.magicLinks);
  await db.delete(schema.refreshTokens);
  await db.delete(schema.users);
  await db.delete(schema.organizations);

  // Clear rate limit keys
  const keysResult = await findKeys('ratelimit:*');
  if (keysResult.success && keysResult.data && keysResult.data.length > 0) {
    await deleteKeys(keysResult.data);
  }
});

// Close connections after all tests
afterAll(async () => {
  await disconnectRedis();
});

// Test utilities
export async function createTestOrg(name = 'Test Org') {
  const [org] = await db.insert(schema.organizations).values({ name }).returning();
  if (!org) throw new Error('Failed to create organization');
  return org;
}

export async function createTestUser(
  orgId: string,
  email = 'test@example.com',
  passwordHash = '$argon2id$v=19$m=65536,t=3,p=4$test'
) {
  const [user] = await db
    .insert(schema.users)
    .values({
      orgId,
      email,
      passwordHash,
      emailVerified: false,
    })
    .returning();
  if (!user) throw new Error('Failed to create user');
  return user;
}

import { afterAll, afterEach, beforeAll } from 'bun:test';
import { db, schema } from '../shared/db';
import { connectRedis, deleteKeys, disconnectRedis, findKeys } from '../shared/lib/redis';

// Connect to test database before all tests
beforeAll(async () => {
  await connectRedis();
});

// Clean up database after each test
afterEach(async () => {
  // Clear all tables in reverse order of FK dependencies
  // 1. Leaf tables (no dependents)
  await db.delete(schema.conversationMessages);
  await db.delete(schema.checkInResponses);
  await db.delete(schema.escalationInstances);
  await db.delete(schema.notifications);
  await db.delete(schema.comments);
  await db.delete(schema.attachments);
  await db.delete(schema.embeddings);
  await db.delete(schema.memories);
  await db.delete(schema.userMessaging);
  await db.delete(schema.visibilityGrants);
  await db.delete(schema.linearSyncMetadata);

  // 2. Mid-level tables
  await db.delete(schema.dependencies);
  await db.delete(schema.blockers);
  await db.delete(schema.checkInBlocks);
  await db.delete(schema.escalationBlocks);
  await db.delete(schema.codingRequests);
  await db.delete(schema.linkedRepos);
  await db.delete(schema.linearIntegrations);
  await db.delete(schema.customFields);
  await db.delete(schema.conversations);

  // 3. Core entity tables
  await db.delete(schema.tasks);
  await db.delete(schema.deliverables);
  await db.delete(schema.deliverableTypes);
  await db.delete(schema.workflows);
  await db.delete(schema.squadMembers);
  await db.delete(schema.squads);
  await db.delete(schema.projectMembers);
  await db.delete(schema.invitations);
  await db.delete(schema.inviteLinks);
  await db.delete(schema.projects);

  // 4. Auth tables
  await db.delete(schema.magicLinks);
  await db.delete(schema.refreshTokens);

  // 5. Root tables
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

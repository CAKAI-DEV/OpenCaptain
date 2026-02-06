import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { hash } from '@node-rs/argon2';
import { db, schema } from '../../../shared/db';
import { connectRedis, deleteKeys, disconnectRedis, findKeys } from '../../../shared/lib/redis';
import {
  acceptInvitation,
  acceptInviteLink,
  createEmailInvitation,
  createShareableLink,
} from '../invitations.service';

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

// Setup
beforeAll(async () => {
  await connectRedis();
});

afterEach(async () => {
  // Delete in order: tables with FKs first, then parent tables
  await db.delete(schema.invitations);
  await db.delete(schema.inviteLinks);
  await db.delete(schema.visibilityGrants);
  await db.delete(schema.magicLinks);
  await db.delete(schema.squadMembers);
  await db.delete(schema.squads);
  await db.delete(schema.projectMembers);
  await db.delete(schema.projects);
  await db.delete(schema.refreshTokens);
  await db.delete(schema.users);
  await db.delete(schema.organizations);

  // Clear rate limit keys
  const keysResult = await findKeys('ratelimit:*');
  if (keysResult.success && keysResult.data && keysResult.data.length > 0) {
    await deleteKeys(keysResult.data);
  }
});

afterAll(async () => {
  await disconnectRedis();
});

// Helper to create test organization
async function createTestOrg(name = 'Test Org') {
  const [org] = await db.insert(schema.organizations).values({ name }).returning();
  if (!org) throw new Error('Failed to create org');
  return org;
}

// Helper to create test user
async function createTestUser(orgId: string, email = 'test@example.com') {
  const [user] = await db
    .insert(schema.users)
    .values({
      orgId,
      email,
      passwordHash: await hash('password123', ARGON2_OPTIONS),
      emailVerified: true,
    })
    .returning();
  if (!user) throw new Error('Failed to create user');
  return user;
}

describe('createEmailInvitation', () => {
  test('returns existing for user already in same org', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id, 'existing@example.com');

    const result = await createEmailInvitation({
      orgId: org.id,
      email: user.email,
      invitedById: user.id,
      role: 'member',
    });

    expect(result.type).toBe('existing');
    expect(result).toHaveProperty('userId', user.id);
  });

  // Skip: Requires valid Resend API key - sends actual emails
  test.skip('auto-adds existing user from different org', async () => {
    const org1 = await createTestOrg('Org 1');
    const org2 = await createTestOrg('Org 2');
    const inviter = await createTestUser(org2.id, 'inviter@example.com');
    const existingUser = await createTestUser(org1.id, 'existing@example.com');

    const result = await createEmailInvitation({
      orgId: org2.id,
      email: existingUser.email,
      invitedById: inviter.id,
      role: 'member',
    });

    expect(result.type).toBe('existing');

    // Verify user was moved to org2
    const updatedUser = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, existingUser.id),
    });
    expect(updatedUser?.orgId).toBe(org2.id);
  }, 15000); // Extended timeout for email API call

  // Skip: Requires valid Resend API key - sends actual emails
  test.skip('creates invitation for new email', async () => {
    const org = await createTestOrg();
    const inviter = await createTestUser(org.id, 'inviter@example.com');

    const result = await createEmailInvitation({
      orgId: org.id,
      email: 'newuser@example.com',
      invitedById: inviter.id,
      role: 'member',
    });

    expect(result.type).toBe('invited');
    expect(result).toHaveProperty('email', 'newuser@example.com');

    // Verify invitation was created in DB
    const invitations = await db.query.invitations.findMany();
    expect(invitations).toHaveLength(1);
    expect(invitations[0]?.email).toBe('newuser@example.com');
    expect(invitations[0]?.tokenHash).toStartWith('$argon2');
  }, 15000); // Extended timeout for email API call
});

describe('createShareableLink', () => {
  test('creates shareable link with token', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);

    const result = await createShareableLink({
      orgId: org.id,
      createdById: user.id,
      role: 'member',
    });

    expect(result.id).toBeString();
    expect(result.url).toContain('/join/');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Verify link was created in DB
    const links = await db.query.inviteLinks.findMany();
    expect(links).toHaveLength(1);
    expect(links[0]?.tokenHash).toStartWith('$argon2');
    expect(links[0]?.usageCount).toBe(0);
  });
});

describe('acceptInvitation', () => {
  test('accepts valid invitation and updates user org', async () => {
    const org1 = await createTestOrg('Org 1');
    const org2 = await createTestOrg('Org 2');
    const inviter = await createTestUser(org2.id, 'inviter@example.com');
    const invitee = await createTestUser(org1.id, 'invitee@example.com');

    // Create invitation manually with known token
    const token = 'test-token-12345678901234567890';
    const tokenHash = await hash(token, ARGON2_OPTIONS);
    await db.insert(schema.invitations).values({
      orgId: org2.id,
      email: invitee.email,
      tokenHash,
      role: 'member',
      invitedById: inviter.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const result = await acceptInvitation(token, invitee.id);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.orgId).toBe(org2.id);
    }

    // Verify user was moved to org2
    const updatedUser = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, invitee.id),
    });
    expect(updatedUser?.orgId).toBe(org2.id);

    // Verify invitation was marked as accepted
    const invitation = await db.query.invitations.findFirst();
    expect(invitation?.acceptedAt).not.toBeNull();
  });

  test('rejects invalid token', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);

    const result = await acceptInvitation('invalid-token', user.id);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Invalid or expired invitation');
    }
  });

  test('rejects expired invitation', async () => {
    const org = await createTestOrg();
    const inviter = await createTestUser(org.id, 'inviter@example.com');
    const invitee = await createTestUser(org.id, 'invitee@example.com');

    // Create expired invitation
    const token = 'expired-token-1234567890123456';
    const tokenHash = await hash(token, ARGON2_OPTIONS);
    await db.insert(schema.invitations).values({
      orgId: org.id,
      email: invitee.email,
      tokenHash,
      role: 'member',
      invitedById: inviter.id,
      expiresAt: new Date(Date.now() - 1000), // Already expired
    });

    const result = await acceptInvitation(token, invitee.id);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Invalid or expired invitation');
    }
  });
});

describe('acceptInviteLink', () => {
  test('accepts valid link and increments usage count', async () => {
    const org1 = await createTestOrg('Org 1');
    const org2 = await createTestOrg('Org 2');
    const creator = await createTestUser(org2.id, 'creator@example.com');
    const joiner = await createTestUser(org1.id, 'joiner@example.com');

    // Create link manually with known token
    const token = 'link-token-123456789012345678';
    const tokenHash = await hash(token, ARGON2_OPTIONS);
    await db.insert(schema.inviteLinks).values({
      orgId: org2.id,
      tokenHash,
      role: 'member',
      createdById: creator.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      usageCount: 0,
    });

    const result = await acceptInviteLink(token, joiner.id);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.orgId).toBe(org2.id);
    }

    // Verify usage count was incremented
    const link = await db.query.inviteLinks.findFirst();
    expect(link?.usageCount).toBe(1);

    // Verify user was moved to org2
    const updatedUser = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, joiner.id),
    });
    expect(updatedUser?.orgId).toBe(org2.id);
  });

  test('rejects invalid token', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);

    const result = await acceptInviteLink('invalid-link-token', user.id);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Invalid or expired invite link');
    }
  });

  test('rejects expired link', async () => {
    const org = await createTestOrg();
    const creator = await createTestUser(org.id, 'creator@example.com');
    const joiner = await createTestUser(org.id, 'joiner@example.com');

    // Create expired link
    const token = 'expired-link-12345678901234567';
    const tokenHash = await hash(token, ARGON2_OPTIONS);
    await db.insert(schema.inviteLinks).values({
      orgId: org.id,
      tokenHash,
      role: 'member',
      createdById: creator.id,
      expiresAt: new Date(Date.now() - 1000), // Already expired
      usageCount: 0,
    });

    const result = await acceptInviteLink(token, joiner.id);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Invalid or expired invite link');
    }
  });

  test('link can be used multiple times before expiry', async () => {
    const org1 = await createTestOrg('Org 1');
    const org2 = await createTestOrg('Org 2');
    const creator = await createTestUser(org2.id, 'creator@example.com');

    // Create link
    const token = 'reusable-link-1234567890123456';
    const tokenHash = await hash(token, ARGON2_OPTIONS);
    await db.insert(schema.inviteLinks).values({
      orgId: org2.id,
      tokenHash,
      role: 'member',
      createdById: creator.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      usageCount: 0,
    });

    // Multiple users join
    const user1 = await createTestUser(org1.id, 'user1@example.com');
    const result1 = await acceptInviteLink(token, user1.id);
    expect(result1.success).toBe(true);

    const user2 = await createTestUser(org1.id, 'user2@example.com');
    const result2 = await acceptInviteLink(token, user2.id);
    expect(result2.success).toBe(true);

    // Verify usage count
    const link = await db.query.inviteLinks.findFirst();
    expect(link?.usageCount).toBe(2);
  });
});

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db, schema } from '../../../shared/db';
import { connectRedis, disconnectRedis } from '../../../shared/lib/redis';
import {
  generateMagicLinkToken,
  generateTokens,
  hashPassword,
  revokeAllRefreshTokens,
  verifyAccessToken,
  verifyPassword,
  verifyRefreshToken,
} from '../auth.service';

// Setup
beforeAll(async () => {
  await connectRedis();
});

// Teardown handled by global tests/setup.ts afterEach

afterAll(async () => {
  await disconnectRedis();
});

// Helper to create test user
async function createTestUser() {
  const [org] = await db.insert(schema.organizations).values({ name: 'Test Org' }).returning();
  if (!org) throw new Error('Failed to create org');

  const [user] = await db
    .insert(schema.users)
    .values({
      orgId: org.id,
      email: 'test@example.com',
      passwordHash: await hashPassword('password123'),
      emailVerified: false,
    })
    .returning();
  if (!user) throw new Error('Failed to create user');

  return { org, user };
}

describe('Password Hashing', () => {
  test('hashPassword returns a hash string', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).toBeString();
    expect(hash).toStartWith('$argon2');
  });

  test('verifyPassword returns true for correct password', async () => {
    const password = 'mypassword123';
    const hash = await hashPassword(password);
    const result = await verifyPassword(hash, password);
    expect(result).toBe(true);
  });

  test('verifyPassword returns false for incorrect password', async () => {
    const hash = await hashPassword('correctpassword');
    const result = await verifyPassword(hash, 'wrongpassword');
    expect(result).toBe(false);
  });

  test('verifyPassword returns false for invalid hash', async () => {
    const result = await verifyPassword('invalid-hash', 'password');
    expect(result).toBe(false);
  });
});

describe('Token Generation', () => {
  test('generateTokens returns access and refresh tokens', async () => {
    const { org, user } = await createTestUser();

    const tokens = await generateTokens({
      id: user.id,
      orgId: org.id,
      email: user.email,
    });

    expect(tokens.accessToken).toBeString();
    expect(tokens.refreshToken).toBeString();
    expect(tokens.accessToken.split('.')).toHaveLength(3); // JWT format
    expect(tokens.refreshToken.split('.')).toHaveLength(3);
  });

  test('generateTokens stores refresh token hash in database', async () => {
    const { org, user } = await createTestUser();

    await generateTokens({
      id: user.id,
      orgId: org.id,
      email: user.email,
    });

    const storedTokens = await db.query.refreshTokens.findMany({
      where: (t, { eq }) => eq(t.userId, user.id),
    });

    expect(storedTokens).toHaveLength(1);
    expect(storedTokens[0]?.tokenHash).toStartWith('$argon2');
  });
});

describe('Access Token Verification', () => {
  test('verifyAccessToken returns payload for valid token', async () => {
    const { org, user } = await createTestUser();

    const { accessToken } = await generateTokens({
      id: user.id,
      orgId: org.id,
      email: user.email,
    });

    const payload = await verifyAccessToken(accessToken);

    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe(user.id);
    expect(payload?.org).toBe(org.id);
    expect(payload?.email).toBe(user.email);
  });

  test('verifyAccessToken returns null for invalid token', async () => {
    const payload = await verifyAccessToken('invalid.token.here');
    expect(payload).toBeNull();
  });

  test('verifyAccessToken returns null for malformed token', async () => {
    const payload = await verifyAccessToken('not-a-jwt');
    expect(payload).toBeNull();
  });
});

describe('Refresh Token Verification', () => {
  test('verifyRefreshToken returns userId for valid token', async () => {
    const { org, user } = await createTestUser();

    const { refreshToken } = await generateTokens({
      id: user.id,
      orgId: org.id,
      email: user.email,
    });

    const result = await verifyRefreshToken(refreshToken);

    expect(result).not.toBeNull();
    expect(result?.userId).toBe(user.id);
  });

  test('verifyRefreshToken deletes used token (rotation)', async () => {
    const { org, user } = await createTestUser();

    const { refreshToken } = await generateTokens({
      id: user.id,
      orgId: org.id,
      email: user.email,
    });

    // First verification should succeed
    const result1 = await verifyRefreshToken(refreshToken);
    expect(result1).not.toBeNull();

    // Second verification should fail (token was deleted)
    const result2 = await verifyRefreshToken(refreshToken);
    expect(result2).toBeNull();
  });

  test('verifyRefreshToken returns null for invalid token', async () => {
    const result = await verifyRefreshToken('invalid.token.here');
    expect(result).toBeNull();
  });
});

describe('Token Revocation', () => {
  test('revokeAllRefreshTokens removes all tokens for user', async () => {
    const { org, user } = await createTestUser();

    // Generate multiple tokens
    await generateTokens({ id: user.id, orgId: org.id, email: user.email });
    await generateTokens({ id: user.id, orgId: org.id, email: user.email });
    await generateTokens({ id: user.id, orgId: org.id, email: user.email });

    // Verify tokens exist
    const beforeRevoke = await db.query.refreshTokens.findMany({
      where: (t, { eq }) => eq(t.userId, user.id),
    });
    expect(beforeRevoke).toHaveLength(3);

    // Revoke all
    await revokeAllRefreshTokens(user.id);

    // Verify tokens are gone
    const afterRevoke = await db.query.refreshTokens.findMany({
      where: (t, { eq }) => eq(t.userId, user.id),
    });
    expect(afterRevoke).toHaveLength(0);
  });
});

describe('Magic Link Token', () => {
  test('generateMagicLinkToken returns a 64-character hex string', () => {
    const token = generateMagicLinkToken();
    expect(token).toBeString();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  test('generateMagicLinkToken returns unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateMagicLinkToken());
    }
    expect(tokens.size).toBe(100);
  });
});

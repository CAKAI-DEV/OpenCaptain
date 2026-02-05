import { sign, verify } from 'hono/jwt';
import { hash, verify as verifyHash } from '@node-rs/argon2';
import { env } from '../lib/env.ts';
import { db, schema } from '../db/index.ts';
import { eq, and, gt } from 'drizzle-orm';
import { randomBytes } from 'crypto';

const ARGON2_OPTIONS = {
  memoryCost: 65536,    // 64 MB
  timeCost: 3,
  parallelism: 4,
};

const ACCESS_TOKEN_EXPIRY = 15 * 60;        // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

export interface TokenPayload {
  sub: string;        // user ID
  org: string;        // organization ID
  email: string;
  iat: number;
  exp: number;
}

export interface RefreshPayload {
  sub: string;
  jti: string;        // token ID for revocation
  iat: number;
  exp: number;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verifyHash(storedHash, password);
  } catch {
    return false;
  }
}

export async function generateTokens(user: { id: string; orgId: string; email: string }) {
  const now = Math.floor(Date.now() / 1000);
  const jti = randomBytes(16).toString('hex');

  const accessToken = await sign(
    {
      sub: user.id,
      org: user.orgId,
      email: user.email,
      iat: now,
      exp: now + ACCESS_TOKEN_EXPIRY,
    } satisfies TokenPayload,
    env.JWT_SECRET
  );

  const refreshToken = await sign(
    {
      sub: user.id,
      jti,
      iat: now,
      exp: now + REFRESH_TOKEN_EXPIRY,
    } satisfies RefreshPayload,
    env.JWT_REFRESH_SECRET
  );

  // Store refresh token hash in database
  const tokenHash = await hash(refreshToken, ARGON2_OPTIONS);
  await db.insert(schema.refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date((now + REFRESH_TOKEN_EXPIRY) * 1000),
  });

  return { accessToken, refreshToken };
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256') as unknown as TokenPayload;
    return payload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const payload = await verify(token, env.JWT_REFRESH_SECRET, 'HS256') as unknown as RefreshPayload;

    // Find matching refresh token in database
    const storedTokens = await db.query.refreshTokens.findMany({
      where: and(
        eq(schema.refreshTokens.userId, payload.sub),
        gt(schema.refreshTokens.expiresAt, new Date())
      ),
    });

    // Verify one of the stored tokens matches
    for (const stored of storedTokens) {
      if (await verifyHash(stored.tokenHash, token)) {
        // Delete the used token (rotation)
        await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.id, stored.id));
        return { userId: payload.sub };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.userId, userId));
}

export function generateMagicLinkToken(): string {
  return randomBytes(32).toString('hex');
}

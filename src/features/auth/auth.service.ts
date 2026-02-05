import { randomBytes } from 'node:crypto';
import { hash, verify as verifyHash } from '@node-rs/argon2';
import { and, eq, gt } from 'drizzle-orm';
import { sign, verify } from 'hono/jwt';
import { db, schema } from '../../shared/db';
import { env } from '../../shared/lib/env';

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
export const MAGIC_LINK_EXPIRY = 15 * 60 * 1000; // 15 minutes in ms

export interface TokenPayload {
  sub: string;
  org: string;
  email: string;
  iat: number;
  exp: number;
}

export interface RefreshPayload {
  sub: string;
  jti: string;
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
    const payload = (await verify(token, env.JWT_SECRET, 'HS256')) as unknown as TokenPayload;
    return payload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const payload = (await verify(
      token,
      env.JWT_REFRESH_SECRET,
      'HS256'
    )) as unknown as RefreshPayload;

    const storedTokens = await db.query.refreshTokens.findMany({
      where: and(
        eq(schema.refreshTokens.userId, payload.sub),
        gt(schema.refreshTokens.expiresAt, new Date())
      ),
    });

    for (const stored of storedTokens) {
      if (await verifyHash(stored.tokenHash, token)) {
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

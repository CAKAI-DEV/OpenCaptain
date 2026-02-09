import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { app } from '../../../index';
import { connectRedis, disconnectRedis } from '../../../shared/lib/redis';

// Setup
beforeAll(async () => {
  await connectRedis();
});

// Teardown handled by global tests/setup.ts afterEach

afterAll(async () => {
  await disconnectRedis();
});

describe('POST /api/v1/auth/register', () => {
  test('creates new user and returns tokens', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new@example.com',
        password: 'password123',
        orgName: 'New Org',
      }),
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe('new@example.com');
    expect(body.accessToken).toBeString();
    expect(body.refreshToken).toBeString();
  });

  test('returns 409 for duplicate email', async () => {
    // Register first user
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'duplicate@example.com',
        password: 'password123',
        orgName: 'Org 1',
      }),
    });

    // Try to register with same email
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'duplicate@example.com',
        password: 'password456',
        orgName: 'Org 2',
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.type).toContain('auth/email-exists');
  });

  test('returns 400 for invalid email', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'password123',
        orgName: 'Test Org',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 for short password', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'short',
        orgName: 'Test Org',
      }),
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  test('returns tokens for valid credentials', async () => {
    // Register user first
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login@example.com',
        password: 'password123',
        orgName: 'Test Org',
      }),
    });

    // Login
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login@example.com',
        password: 'password123',
      }),
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.email).toBe('login@example.com');
    expect(body.accessToken).toBeString();
    expect(body.refreshToken).toBeString();
  });

  test('returns 401 for wrong password', async () => {
    // Register user first
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'wrongpass@example.com',
        password: 'correctpassword',
        orgName: 'Test Org',
      }),
    });

    // Login with wrong password
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'wrongpass@example.com',
        password: 'wrongpassword',
      }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.type).toContain('auth/invalid-credentials');
  });

  test('returns 401 for non-existent user', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'password123',
      }),
    });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  test('returns new tokens for valid refresh token', async () => {
    // Register and get tokens
    const registerRes = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'refresh@example.com',
        password: 'password123',
        orgName: 'Test Org',
      }),
    });
    const { refreshToken } = await registerRes.json();

    // Refresh
    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.accessToken).toBeString();
    expect(body.refreshToken).toBeString();
    expect(body.refreshToken).not.toBe(refreshToken); // Should be rotated
  });

  test('returns 401 for invalid refresh token', async () => {
    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'invalid.token.here' }),
    });

    expect(res.status).toBe(401);
  });

  test('returns 401 for reused refresh token', async () => {
    // Register and get tokens
    const registerRes = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'reuse@example.com',
        password: 'password123',
        orgName: 'Test Org',
      }),
    });
    const { refreshToken } = await registerRes.json();

    // First refresh should work
    const res1 = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    expect(res1.status).toBe(200);

    // Second refresh with same token should fail
    const res2 = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    expect(res2.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  test('revokes all refresh tokens', async () => {
    // Register and get tokens
    const registerRes = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'logout@example.com',
        password: 'password123',
        orgName: 'Test Org',
      }),
    });
    const { accessToken, refreshToken } = await registerRes.json();

    // Logout
    const logoutRes = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(logoutRes.status).toBe(200);

    // Refresh should now fail
    const refreshRes = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    expect(refreshRes.status).toBe(401);
  });

  test('returns 401 without auth header', async () => {
    const res = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(401);
  });
});

describe('Health Endpoints', () => {
  test('GET /api/v1/health returns health status', async () => {
    const res = await app.request('/api/v1/health');

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.database.status).toBe('healthy');
    expect(body.checks.redis.status).toBe('healthy');
  });

  test('GET /api/v1/health/live returns ok', async () => {
    const res = await app.request('/api/v1/health/live');

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/v1/health/ready returns ready', async () => {
    const res = await app.request('/api/v1/health/ready');

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ready');
  });
});

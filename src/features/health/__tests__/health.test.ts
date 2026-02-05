import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { connectRedis, disconnectRedis } from '../../../shared/lib/redis';
import { checkDatabase, checkRedis } from '../health.routes';

beforeAll(async () => {
  await connectRedis();
});

afterAll(async () => {
  await disconnectRedis();
});

describe('Health Checks', () => {
  test('checkDatabase returns healthy status with latency', async () => {
    const result = await checkDatabase();

    expect(result.status).toBe('healthy');
    expect(result.latency).toBeNumber();
    expect(result.latency).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  test('checkRedis returns healthy status with latency', async () => {
    const result = await checkRedis();

    expect(result.status).toBe('healthy');
    expect(result.latency).toBeNumber();
    expect(result.latency).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });
});

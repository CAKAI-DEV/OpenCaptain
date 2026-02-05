import { Hono } from 'hono';
import { db } from '../../db/index.ts';
import { redis } from '../../lib/redis.ts';
import { sql } from 'drizzle-orm';
import { logger } from '../../lib/logger.ts';

const app = new Hono();

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
  };
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: 'healthy', latency: Date.now() - start };
  } catch (err) {
    logger.error({ err }, 'Database health check failed');
    return { status: 'unhealthy', error: 'Connection failed' };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await redis.ping();
    return { status: 'healthy', latency: Date.now() - start };
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return { status: 'unhealthy', error: 'Connection failed' };
  }
}

// Detailed health check (for monitoring)
app.get('/', async (c) => {
  const [database, redisCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const allHealthy = database.status === 'healthy' && redisCheck.status === 'healthy';
  const allUnhealthy = database.status === 'unhealthy' && redisCheck.status === 'unhealthy';

  const response: HealthResponse = {
    status: allUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    checks: {
      database,
      redis: redisCheck,
    },
  };

  const statusCode = response.status === 'unhealthy' ? 503 : 200;
  return c.json(response, statusCode);
});

// Simple liveness probe (for Kubernetes/Docker)
app.get('/live', (c) => {
  return c.json({ status: 'ok' });
});

// Readiness probe (for Kubernetes/Docker)
app.get('/ready', async (c) => {
  const [database, redisCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  if (database.status === 'unhealthy' || redisCheck.status === 'unhealthy') {
    return c.json({ status: 'not ready' }, 503);
  }

  return c.json({ status: 'ready' });
});

export default app;

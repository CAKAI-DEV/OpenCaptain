import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { ping } from '../../shared/lib/redis';

const health = new Hono();

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
  };
}

export async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: 'healthy', latency: Date.now() - start };
  } catch (err) {
    logger.error({ err }, 'Database health check failed');
    return { status: 'unhealthy', error: 'Connection failed' };
  }
}

export async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  const result = await ping();

  if (!result.success) {
    logger.error({ error: result.error }, 'Redis health check failed');
    return { status: 'unhealthy', error: 'Connection failed' };
  }

  return { status: 'healthy', latency: Date.now() - start };
}

// GET / - Detailed health check
health.get('/', async (c) => {
  const [database, redisCheck] = await Promise.all([checkDatabase(), checkRedis()]);

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

// GET /live - Liveness probe
health.get('/live', (c) => {
  return c.json({ status: 'ok' });
});

// GET /ready - Readiness probe
health.get('/ready', async (c) => {
  const [database, redisCheck] = await Promise.all([checkDatabase(), checkRedis()]);

  if (database.status === 'unhealthy' || redisCheck.status === 'unhealthy') {
    return c.json({ status: 'not ready' }, 503);
  }

  return c.json({ status: 'ready' });
});

export { health as healthRoutes };

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { env } from './lib/env.ts';
import { logger } from './lib/logger.ts';
import { connectRedis } from './lib/redis.ts';
import { ApiError, type ProblemDetails } from './middleware/error-handler.ts';
import routes from './routes/index.ts';

const app = new Hono();

// Global middleware
app.use('*', cors({ origin: env.CORS_ORIGIN, credentials: true }));

// Global error handler
app.onError((err, c) => {
  const instance = c.req.path;

  // Check for ApiError by name property (more reliable across module boundaries)
  if (err instanceof Error && err.name === 'ApiError') {
    const apiErr = err as ApiError;
    logger.warn({ err, path: instance }, 'API error');
    c.header('Content-Type', 'application/problem+json');
    return c.json(apiErr.toProblemDetails(instance), apiErr.status);
  }

  if (err instanceof HTTPException) {
    const problem: ProblemDetails = {
      type: 'https://blockbot.dev/errors/http-exception',
      title: err.message || 'HTTP Exception',
      status: err.status,
      instance,
    };
    c.header('Content-Type', 'application/problem+json');
    return c.json(problem, err.status);
  }

  // Unexpected error
  logger.error({ err, path: instance }, 'Unexpected error');
  const problem: ProblemDetails = {
    type: 'https://blockbot.dev/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    instance,
  };
  c.header('Content-Type', 'application/problem+json');
  return c.json(problem, 500);
});

// Health check (unprotected)
app.get('/health', async (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.route('/api/v1', routes);

// Start server
async function main() {
  await connectRedis();
  logger.info({ port: env.PORT }, 'Starting BlockBot API');

  Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  });

  logger.info({ port: env.PORT }, 'BlockBot API started');
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

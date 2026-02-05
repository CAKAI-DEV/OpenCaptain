import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { authRoutes } from './features/auth';
import { conversationRoutes } from './features/conversations';
import { deliverablesRoutes } from './features/deliverables';
import { docsRoutes } from './features/docs';
import { healthRoutes } from './features/health';
import { invitationRoutes } from './features/invitations';
import { startMemoryConsolidationWorker } from './features/memory';
import { projectRoutes } from './features/projects';
import { rolesRoutes } from './features/roles';
import { tasksRoutes } from './features/tasks';
import { teamsRoutes } from './features/teams';
import { visibilityRoutes } from './features/visibility';
import {
  type ApiError,
  apiRateLimiter,
  authRateLimiter,
  connectRedis,
  disconnectRedis,
  env,
  logger,
  type ProblemDetails,
  requestIdMiddleware,
  requestLoggerMiddleware,
  securityHeadersMiddleware,
} from './shared';
import { closeAllWorkers, closeQueueConnections } from './shared/lib/queue';

const app = new Hono();

// Global middleware (order matters)
app.use('*', requestIdMiddleware);
app.use('*', securityHeadersMiddleware);
app.use('*', requestLoggerMiddleware);
app.use('*', compress());
app.use('*', cors({ origin: env.CORS_ORIGIN, credentials: true }));

// Global error handler
app.onError((err, c) => {
  const instance = c.req.path;
  const requestId = c.get('requestId');

  if (err instanceof Error && err.name === 'ApiError') {
    const apiErr = err as ApiError;
    logger.warn({ err, path: instance, requestId }, 'API error');
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

  logger.error({ err, path: instance, requestId }, 'Unexpected error');
  const problem: ProblemDetails = {
    type: 'https://blockbot.dev/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    instance,
  };
  c.header('Content-Type', 'application/problem+json');
  return c.json(problem, 500);
});

// Simple health check (unprotected, no rate limiting)
app.get('/health', async (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes with stricter rate limiting
app.use('/api/v1/auth/*', authRateLimiter);

// All API routes with standard rate limiting
app.use('/api/v1/*', apiRateLimiter);

// Feature routes
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/health', healthRoutes);
app.route('/api/v1/invitations', invitationRoutes);
app.route('/api/v1/projects', projectRoutes);
app.route('/api/v1/squads', teamsRoutes);
app.route('/api/v1/tasks', tasksRoutes);
app.route('/api/v1/deliverables', deliverablesRoutes);
app.route('/api/v1/visibility', visibilityRoutes);
app.route('/api/v1/conversations', conversationRoutes);
app.route('/api/v1', rolesRoutes);

// API Documentation (Swagger UI)
app.route('/docs', docsRoutes);

// Graceful shutdown handler
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Received shutdown signal, closing connections...');

  try {
    // Close BullMQ workers and connections
    await closeAllWorkers();
    logger.info('BullMQ workers closed');
    await closeQueueConnections();
    logger.info('BullMQ queue connections closed');

    // Close Redis connection
    await disconnectRedis();
    logger.info('Redis connection closed');

    // Note: Drizzle with postgres.js doesn't require explicit close
    // The connection pool will be cleaned up automatically

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

// Start server (only when run directly, not when imported for tests)
async function main() {
  await connectRedis();
  logger.info({ port: env.PORT }, 'Starting BlockBot API');

  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  });

  // Start background workers
  startMemoryConsolidationWorker();

  logger.info({ port: env.PORT }, 'BlockBot API started');

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

// Only start server if this is the main module
if (import.meta.main) {
  main().catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
}

export { app };

import { Hono } from 'hono';
import { env } from './lib/env.ts';
import { logger } from './lib/logger.ts';
import { connectRedis } from './lib/redis.ts';
import { db } from './db/index.ts';

const app = new Hono();

app.get('/health', async (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

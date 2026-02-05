import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../lib/env';
import * as schema from './schema';

// Configure connection pool based on environment
const isProduction = process.env.NODE_ENV === 'production';

const client = postgres(env.DATABASE_URL, {
  // Connection pool settings
  max: isProduction ? 20 : 5, // Max connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds

  // Query settings
  prepare: true, // Use prepared statements

  // Production-specific settings
  ...(isProduction && {
    ssl: { rejectUnauthorized: false }, // Enable SSL in production
  }),
});

export const db = drizzle(client, { schema });
export { schema };

// Export client for graceful shutdown if needed
export { client as pgClient };

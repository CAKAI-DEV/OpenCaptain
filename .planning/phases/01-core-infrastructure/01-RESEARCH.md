# Phase 1: Core Infrastructure - Research

**Researched:** 2026-02-05
**Domain:** Backend infrastructure (Bun, PostgreSQL, Redis, Docker, Authentication)
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational infrastructure for BlockBot: database with migrations, caching/sessions, authentication, API gateway, and Docker deployment. The research validates the user's technology choices and provides recommendations for discretionary decisions.

The standard approach for this stack in 2026 is:
- **Runtime:** Bun with Hono framework (lightweight, fast, excellent TypeScript support)
- **Database:** PostgreSQL with Drizzle ORM (TypeScript-native, type-safe migrations)
- **Cache/Sessions:** Redis for sessions and rate limiting (queues deferred to later phases)
- **Authentication:** JWT with refresh tokens, Argon2 for password hashing, magic links via Resend
- **Deployment:** Docker Compose with profiles, Traefik for reverse proxy with auto SSL

**Primary recommendation:** Use Hono framework with Bun for the API layer. Use shared tables with org_id + Row Level Security (RLS) for multi-tenancy. Use RFC 7807 Problem Details for error responses. Use .env files (not Docker secrets) for simplicity in self-hosted deployments.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun | 1.2+ | Runtime | 3-4x faster than Node.js, native TypeScript, built-in .env parsing |
| Hono | 4.x | Web framework | Ultrafast, lightweight, excellent TypeScript support, built-in JWT middleware |
| Drizzle ORM | 0.30+ | Database ORM | TypeScript-native, type-safe migrations, excellent PostgreSQL support |
| PostgreSQL | 16+ | Primary database | Industry standard, supports RLS for multi-tenancy |
| Redis | 7+ | Sessions & rate limiting | Fast, mature, perfect for sessions and sliding window rate limits |
| Traefik | 3.x | Reverse proxy | Auto SSL via Let's Encrypt, Docker-native labels |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.x | Validation | Environment variables, request validation, type inference |
| Pino | 9.x | Logging | Structured JSON logging, high performance with Bun |
| Resend | SDK | Transactional email | Magic link emails, future notifications |
| @hono/jwt | (bundled) | JWT handling | Built into Hono, validates access/refresh tokens |
| postgres | 3.x | PostgreSQL driver | postgres.js - fast, full-featured driver for Drizzle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hono | Elysia | Elysia is Bun-only (no portability), Hono runs anywhere |
| Hono | tRPC | tRPC requires TypeScript clients; REST/Hono better for messaging bots |
| Argon2 | bcrypt | bcrypt is battle-tested but less resistant to GPU attacks |
| Resend | SendGrid | SendGrid is more established but Resend has better DX |

**Installation:**
```bash
bun add hono @hono/node-server drizzle-orm postgres zod pino resend
bun add -d drizzle-kit @types/bun
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/
│   ├── schema/           # Drizzle schema definitions
│   │   ├── users.ts
│   │   ├── organizations.ts
│   │   └── index.ts
│   ├── migrations/       # Generated SQL migrations
│   └── index.ts          # Database connection
├── routes/
│   ├── auth/             # Authentication routes
│   ├── health/           # Health check endpoints
│   └── index.ts          # Route aggregation
├── middleware/
│   ├── auth.ts           # JWT validation middleware
│   ├── rateLimit.ts      # Rate limiting middleware
│   └── errorHandler.ts   # RFC 7807 error handling
├── services/
│   ├── auth.ts           # Auth business logic
│   └── email.ts          # Email sending (Resend)
├── lib/
│   ├── env.ts            # Environment validation with Zod
│   ├── logger.ts         # Pino logger setup
│   └── redis.ts          # Redis connection
└── index.ts              # Application entry point
```

### Pattern 1: Environment Validation with Zod
**What:** Validate and type environment variables at startup
**When to use:** Always - prevents runtime errors from missing config
**Example:**
```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().startsWith('re_'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(Bun.env);
export type Env = z.infer<typeof envSchema>;
```

### Pattern 2: Multi-Tenancy with Shared Tables + RLS
**What:** Single database schema with org_id column and Row Level Security
**When to use:** Self-hosted deployments with reasonable tenant counts (<1000)
**Why chosen over schema-per-tenant:**
- Simpler operations (single migration applies to all tenants)
- Lower connection overhead
- RLS prevents accidental cross-tenant data leaks at database level
- Scales well for self-hosted scenarios
**Example:**
```typescript
// src/db/schema/base.ts
import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';

// Base columns for multi-tenant tables
export const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
};

// Enable RLS on table creation
// CREATE POLICY org_isolation ON users
//   USING (org_id = current_setting('app.current_org_id')::uuid);
```

### Pattern 3: JWT with Refresh Token Flow
**What:** Short-lived access tokens (15min), long-lived refresh tokens (7 days)
**When to use:** All authenticated API access
**Example:**
```typescript
// Access token: 15 minutes, contains user claims
// Refresh token: 7 days, stored in httpOnly cookie, rotated on use

interface AccessTokenPayload {
  sub: string;        // user ID
  org: string;        // organization ID
  role: string;       // user role
  iat: number;
  exp: number;
}

interface RefreshTokenPayload {
  sub: string;        // user ID
  jti: string;        // unique token ID (for revocation)
  iat: number;
  exp: number;
}
```

### Pattern 4: RFC 7807 Problem Details for Errors
**What:** Standardized error response format
**When to use:** All API error responses
**Example:**
```typescript
// Content-Type: application/problem+json
interface ProblemDetails {
  type: string;       // URI reference identifying error type
  title: string;      // Short human-readable summary
  status: number;     // HTTP status code
  detail?: string;    // Human-readable explanation
  instance?: string;  // URI reference to specific occurrence
}

// Example response:
{
  "type": "https://blockbot.dev/errors/auth/invalid-token",
  "title": "Invalid Authentication Token",
  "status": 401,
  "detail": "The provided access token has expired"
}
```

### Pattern 5: Sliding Window Rate Limiting with Redis
**What:** Per-user and per-org rate limits using Redis sorted sets
**When to use:** All authenticated API endpoints
**Example:**
```typescript
// Key format: ratelimit:{orgId}:{userId}:{endpoint}
// Uses sorted set with timestamp scores
// Lua script ensures atomic check-and-increment

const LIMITS = {
  orgWide: { requests: 10000, window: 3600 },     // 10k/hour per org
  perUser: { requests: 1000, window: 3600 },      // 1k/hour per user
  perEndpoint: { requests: 100, window: 60 },     // 100/min per endpoint
};
```

### Anti-Patterns to Avoid
- **Hand-rolling JWT validation:** Use Hono's built-in JWT middleware
- **Missing RLS policies:** Every multi-tenant table MUST have RLS enabled
- **Storing secrets in code:** All secrets via environment variables
- **Synchronous logging:** Use Pino's async transport, never console.log in production
- **Missing rate limits:** Every public endpoint needs rate limiting from day 1

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT validation | Custom JWT parsing | Hono JWT middleware | Handles expiry, signatures, claims correctly |
| Password hashing | bcrypt wrapper | Argon2 via `@node-rs/argon2` | GPU-resistant, memory-hard, modern standard |
| Rate limiting | Simple counter | Redis sorted sets + Lua | Atomic operations, sliding window accuracy |
| Email sending | SMTP client | Resend SDK | Deliverability, analytics, React Email support |
| Logging | console.log wrapper | Pino | Structured JSON, async, configurable levels |
| Env validation | Manual checks | Zod schema | Type inference, detailed error messages |
| SQL queries | String concatenation | Drizzle prepared statements | SQL injection protection, type safety |

**Key insight:** These "simple" problems have solved edge cases (race conditions, timing attacks, malformed inputs) that take months to discover through production issues. The libraries handle them correctly.

## Common Pitfalls

### Pitfall 1: Missing org_id in WHERE Clauses
**What goes wrong:** Queries return data from all organizations
**Why it happens:** Easy to forget tenant filter when writing new queries
**How to avoid:** Enable PostgreSQL RLS; set `app.current_org_id` at connection start
**Warning signs:** Tests pass but cross-tenant data appears in production

### Pitfall 2: Refresh Token Not Rotated
**What goes wrong:** Stolen refresh token remains valid indefinitely
**Why it happens:** Only implementing access token refresh, not rotation
**How to avoid:** Issue new refresh token with each use, invalidate old one
**Warning signs:** Same refresh token JTI appearing in logs across days

### Pitfall 3: Rate Limiter Race Conditions
**What goes wrong:** Requests slip through during high concurrency
**Why it happens:** Check-then-increment without atomicity
**How to avoid:** Use Lua scripts for atomic Redis operations
**Warning signs:** Rate limit of 100 allowing 105+ requests in tests

### Pitfall 4: Docker Health Check Timing
**What goes wrong:** App starts before PostgreSQL/Redis are ready
**Why it happens:** depends_on only waits for container start, not service ready
**How to avoid:** Use `depends_on: condition: service_healthy` with health checks
**Warning signs:** Connection refused errors on cold starts

### Pitfall 5: Magic Link Token Reuse
**What goes wrong:** Magic link can be used multiple times
**Why it happens:** Token not invalidated after first use
**How to avoid:** Delete token from database on successful verification
**Warning signs:** Same magic link working hours after initial login

### Pitfall 6: Missing CORS Configuration
**What goes wrong:** Web UI cannot call API from different origin
**Why it happens:** API and web UI on different ports/domains
**How to avoid:** Configure Hono CORS middleware with explicit origins
**Warning signs:** "CORS policy" errors in browser console

## Code Examples

Verified patterns from official sources:

### Hono App Setup with Middleware
```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { jwt } from 'hono/jwt';
import { env } from './lib/env';

const app = new Hono();

// Global middleware
app.use('*', cors({ origin: env.CORS_ORIGIN }));
app.use('*', logger());

// Protected routes
app.use('/api/v1/*', jwt({ secret: env.JWT_SECRET }));

// Health check (unprotected)
app.get('/health', (c) => c.json({ status: 'ok' }));

export default {
  port: env.PORT || 3000,
  fetch: app.fetch,
};
```

### Drizzle Schema with Multi-Tenancy
```typescript
// src/db/schema/users.ts
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Drizzle Migration Command
```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;

// Commands:
// bun drizzle-kit generate  -- Generate migration from schema changes
// bun drizzle-kit migrate   -- Apply migrations to database
```

### Docker Compose with Health Checks
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: blockbot
      POSTGRES_USER: blockbot
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U blockbot"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://blockbot:${POSTGRES_PASSWORD}@postgres:5432/blockbot
      REDIS_URL: redis://redis:6379
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.${DOMAIN}`)"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"

  traefik:
    image: traefik:v3.0
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt

volumes:
  postgres_data:
  letsencrypt:
```

### Argon2 Password Hashing
```typescript
// src/services/auth.ts
import { hash, verify } from '@node-rs/argon2';

const ARGON2_OPTIONS = {
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,       // 4 parallel threads
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return verify(hash, password);
}
```

### Pino Logger Setup
```typescript
// src/lib/logger.ts
import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Usage: logger.info({ userId, action }, 'User logged in');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| serial columns | identity columns | PostgreSQL 10+ | Drizzle uses identity by default |
| bcrypt | Argon2id | 2019 (OWASP recommendation) | Better GPU resistance |
| Express.js | Hono/Elysia | 2023-2024 | 10-30x performance improvement |
| TypeORM | Drizzle ORM | 2023-2024 | Better TypeScript integration, smaller bundle |
| JWT in localStorage | httpOnly cookies | Always was best practice | Prevents XSS token theft |
| Custom error formats | RFC 7807 | 2016 (RFC published) | Standardized error handling |

**Deprecated/outdated:**
- **wait-for-it scripts:** Use Docker Compose health checks instead
- **Passport.js:** Overkill for simple JWT auth; Hono middleware is simpler
- **Sequelize:** Use Drizzle for TypeScript projects
- **Custom rate limiters:** Use proven Redis patterns with Lua scripts

## Discretionary Recommendations

Based on research, here are recommendations for items marked as Claude's discretion:

### Multi-Tenancy: Shared Tables with RLS
**Recommendation:** Use shared tables with org_id column and PostgreSQL Row Level Security
**Rationale:**
- Simpler operations for self-hosted deployments
- RLS prevents accidental cross-tenant queries at database level
- Works well for expected scale (<1000 organizations)
- Schema-per-tenant adds operational complexity not justified for this use case

### Redis Usage: Sessions and Rate Limiting Only
**Recommendation:** Use Redis for sessions and rate limiting in Phase 1. Defer queue usage to later phases.
**Rationale:**
- Sessions need fast lookups (Redis excels)
- Rate limiting requires atomic operations (Redis Lua scripts)
- Queues not needed until Phase 5/6 (messaging, scheduled jobs)
- BullMQ can be added later without refactoring

### API Style: REST with Hono
**Recommendation:** Use REST API with Hono framework
**Rationale:**
- Messaging bots (Phase 5) won't use TypeScript clients, ruling out tRPC's main benefit
- REST is universally understood and documented
- Hono provides excellent DX with TypeScript while staying REST-compatible
- URL versioning (/api/v1/) already decided by user

### Error Response Format: RFC 7807 Problem Details
**Recommendation:** Use RFC 7807 Problem Details JSON format
**Rationale:**
- Industry standard for REST APIs
- Machine-readable and human-readable
- Extensible for custom error properties
- Content-Type: application/problem+json

### Secrets Management: .env Files
**Recommendation:** Use .env files (not Docker secrets)
**Rationale:**
- Docker secrets require Swarm mode, adding complexity for self-hosters
- .env files are universally understood
- Documentation is simpler: "copy .env.example to .env and fill in values"
- Security trade-off acceptable for self-hosted deployments

## Open Questions

Things that couldn't be fully resolved:

1. **Bun + postgres.js Stability**
   - What we know: Bun 1.2+ has near-complete Node.js compatibility
   - What's unclear: Edge cases with connection pooling under high load
   - Recommendation: Test with realistic load in Phase 1; have fallback to node-postgres

2. **Traefik v3 + Docker Compose Profiles**
   - What we know: Traefik v3 works with Docker Compose
   - What's unclear: Best way to conditionally include Traefik only in prod profile
   - Recommendation: Use separate compose files (docker-compose.yml + docker-compose.prod.yml)

3. **RLS Performance Impact**
   - What we know: RLS adds overhead to every query
   - What's unclear: Magnitude of overhead for BlockBot's query patterns
   - Recommendation: Enable RLS; benchmark early; can optimize hot paths if needed

## Sources

### Primary (HIGH confidence)
- [Hono documentation](https://hono.dev/docs/getting-started/bun) - Framework setup, middleware
- [Drizzle ORM documentation](https://orm.drizzle.team/docs/migrations) - Migrations, schema patterns
- [Bun documentation](https://bun.com/docs/runtime/http/server) - Runtime, testing, environment
- [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807) - Problem Details specification
- [Redis Rate Limiting](https://redis.io/glossary/rate-limiting/) - Sliding window patterns

### Secondary (MEDIUM confidence)
- [Pino Logger Guide 2026](https://signoz.io/guides/pino-logger/) - Structured logging with Bun
- [Docker Compose Health Checks](https://docs.docker.com/compose/how-tos/startup-order/) - Service dependencies
- [Traefik Docker Setup](https://doc.traefik.io/traefik/user-guides/docker-compose/acme-tls/) - Auto SSL configuration
- [Argon2 vs bcrypt](https://stytch.com/blog/argon2-vs-bcrypt-vs-scrypt/) - Password hashing comparison
- [PostgreSQL Multi-Tenancy](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy) - RLS patterns

### Tertiary (LOW confidence)
- [Elysia vs Hono comparison](https://dev.to/this-is-learning/hono-vs-h3-vs-hattip-vs-elysia-modern-serverless-replacements-for-express-3a6n) - Framework comparison (single source)
- [tRPC vs REST 2026](https://dev.to/dataformathub/rest-vs-graphql-vs-trpc-the-ultimate-api-design-guide-for-2026-8n3) - API style guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified via official docs and multiple sources
- Architecture patterns: HIGH - Based on official documentation patterns
- Multi-tenancy recommendation: MEDIUM - Based on multiple sources but specific to BlockBot's scale
- Pitfalls: MEDIUM - Gathered from community sources and best practice guides

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stack is stable)

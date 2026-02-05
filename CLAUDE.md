# BlockBot API

Self-hosted project management agent API built with Bun, Hono, PostgreSQL, and Redis.

## Tech Stack

- **Runtime**: Bun (use instead of Node.js)
- **Framework**: Hono (lightweight, fast web framework)
- **Database**: PostgreSQL with Drizzle ORM
- **Cache/Rate Limiting**: Redis
- **Auth**: JWT (access + refresh tokens) with Argon2 password hashing
- **Validation**: Zod
- **Linting**: Biome
- **Docs**: OpenAPI 3.1 with Swagger UI

## Project Structure

```
src/
├── features/           # Feature-based modules
│   ├── auth/          # Authentication
│   │   ├── __tests__/ # Unit and integration tests
│   │   ├── auth.routes.ts
│   │   ├── auth.service.ts
│   │   ├── auth.middleware.ts
│   │   └── auth.email.ts
│   ├── health/        # Health checks
│   │   └── __tests__/
│   └── docs/          # API documentation (Swagger)
├── shared/            # Cross-cutting concerns
│   ├── db/           # Drizzle schema and migrations
│   ├── lib/          # Utilities (env, logger, redis)
│   ├── middleware/   # Global middleware
│   ├── openapi/      # OpenAPI schemas
│   └── types/        # Shared types
├── tests/            # Test setup and utilities
└── index.ts          # App entry point
```

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server with hot reload
bun run start        # Start production server
bun run build        # Build to dist/
bun run typecheck    # TypeScript type checking

bun run lint         # Run Biome linter
bun run lint:fix     # Fix lint issues
bun run format       # Format code
bun run check        # Lint + format check
bun run check:fix    # Fix all issues

bun run test         # Run all tests
bun run test:unit    # Run unit tests only
bun run test:integration  # Run integration tests only
bun run test:coverage     # Run with coverage

bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio
```

## Environment Variables

Required in `.env`:
```
PORT=3000
DATABASE_URL=postgres://user:pass@localhost:5432/blockbot
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
RESEND_API_KEY=your-resend-key
CORS_ORIGIN=http://localhost:3000
MAGIC_LINK_BASE_URL=http://localhost:3000
```

## API Documentation

Swagger UI available at: `http://localhost:3000/docs`
OpenAPI JSON spec at: `http://localhost:3000/docs/openapi.json`

## API Conventions

### Error Responses (RFC 7807)
All errors return Problem Details JSON:
```json
{
  "type": "https://blockbot.dev/errors/auth/invalid-credentials",
  "title": "Invalid Credentials",
  "status": 401,
  "detail": "Email or password is incorrect",
  "instance": "/api/v1/auth/login"
}
```

### Request ID Tracing
All requests get a unique `X-Request-ID` header for tracing. Pass your own ID or let the server generate one. The ID appears in all logs for that request.

### Redis Operations
Use standardized functions from `src/shared/lib/redis`:
```ts
import { getValue, setValue, checkRateLimit } from '../shared/lib/redis';

// All operations return RedisResult<T>
const result = await getValue<User>('user:123');
if (result.success) {
  console.log(result.data);
}
```

### Response Types
Use standardized response helpers:
```ts
import { createResponse, createPaginatedResponse } from '../shared/types';

// Simple response
return c.json(createResponse({ id: '123', name: 'Test' }));

// Paginated response
return c.json(createPaginatedResponse(items, { page: 1, limit: 10, total: 100 }));
```

## Middleware Stack

Applied to all routes (in order):
1. **Request ID** - Adds `X-Request-ID` header
2. **Security Headers** - X-Content-Type-Options, X-Frame-Options, CSP, etc.
3. **Request Logger** - Logs method, path, status, duration
4. **Compression** - gzip/brotli response compression
5. **CORS** - Cross-origin resource sharing

## Testing Conventions

- Unit tests: `*.test.ts` in feature's `__tests__/` folder
- Integration tests: `*.integration.test.ts`
- Tests use real PostgreSQL and Redis (from docker-compose)
- Each test file manages its own setup/teardown

## Code Style

- Use Biome for linting/formatting
- Feature-based architecture (group by domain, not layer)
- Prefer early returns over nested conditionals
- Use Zod for request validation
- Export types with `export type` (verbatimModuleSyntax)
- Pre-commit hooks run lint-staged automatically

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
- **Lint**: Biome lint + TypeScript typecheck
- **Test**: Run all tests with PostgreSQL and Redis services
- **Build**: Compile and upload artifacts

## Production Considerations

- Database connection pooling configured (max 20 connections)
- SSL enabled for database in production
- Graceful shutdown handles SIGTERM/SIGINT
- Security headers added (HSTS in production only)
- Rate limiting on all API routes

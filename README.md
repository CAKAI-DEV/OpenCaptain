# BlockBot

Self-hosted project management agent API.

## Quick Start

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Install dependencies
bun install

# Run migrations
bun run db:migrate

# Start dev server
bun run dev
```

API available at `http://localhost:3000`
Swagger UI at `http://localhost:3000/docs`

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with hot reload |
| `bun run start` | Start production server |
| `bun run build` | Build to `dist/` |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | Run linter |
| `bun run test` | Run all tests |
| `bun run db:migrate` | Run database migrations |
| `bun run db:studio` | Open Drizzle Studio |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login with email/password |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Revoke all refresh tokens |
| POST | `/api/v1/auth/magic-link/request` | Request magic link |
| GET | `/api/v1/auth/magic-link/verify` | Verify magic link |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Simple health check |
| GET | `/api/v1/health` | Detailed health status |
| GET | `/api/v1/health/live` | Liveness probe |
| GET | `/api/v1/health/ready` | Readiness probe |

### Documentation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/docs` | Swagger UI |
| GET | `/docs/openapi.json` | OpenAPI spec |

## Features

- **Request Tracing**: All requests get unique `X-Request-ID` headers
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.
- **Rate Limiting**: Sliding window algorithm with Redis
- **Compression**: gzip/brotli response compression
- **Graceful Shutdown**: Clean connection handling on SIGTERM
- **API Documentation**: OpenAPI 3.1 with Swagger UI

## Environment

Copy `.env.example` to `.env` and configure:

```env
PORT=3000
DATABASE_URL=postgres://blockbot:blockbot@localhost:5432/blockbot
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
RESEND_API_KEY=your-resend-key
CORS_ORIGIN=http://localhost:3000
MAGIC_LINK_BASE_URL=http://localhost:3000
```

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Hono](https://hono.dev)
- **Database**: PostgreSQL + [Drizzle ORM](https://orm.drizzle.team)
- **Cache**: Redis
- **Auth**: JWT + Argon2
- **Validation**: Zod
- **Linting**: Biome
- **Docs**: OpenAPI + Swagger UI

## Development

Pre-commit hooks are configured with Husky and lint-staged. Commits will automatically run linting on staged files.

## License

MIT

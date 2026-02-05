# Phase 1: Core Infrastructure - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy BlockBot with database, cache, authentication, and API gateway. System must be deployable via Docker Compose on a VPS with documented steps, configurable LLM tokens, and proper authentication on all API endpoints.

</domain>

<decisions>
## Implementation Decisions

### Database Design
- Multi-tenancy approach: Claude's discretion (shared tables with org_id vs schema-per-org)
- Migration tooling: Drizzle ORM migrations (TypeScript-native, type-safe)
- Redis usage: Claude's discretion based on Phase 1 needs
- Runtime: Bun (faster startup, built-in TypeScript)

### Authentication Flow
- Strategy: JWT with refresh tokens (short-lived access, long-lived refresh)
- Bot authentication: Internal trust (services in same network, no inter-service auth)
- User access methods: Both email magic link and email + password (user chooses)
- OAuth: Not in Phase 1 — email only to keep it simple

### API Structure
- Style: Claude's discretion (REST/tRPC/GraphQL based on messaging bot + web UI needs)
- Error format: Claude's discretion (consistent approach)
- Versioning: URL path versioning (/api/v1/...)
- Rate limiting: Both org-wide cap and per-user fairness limits

### Deployment Config
- Docker Compose: Profile-based (--profile dev or --profile prod)
- Secrets management: Claude's discretion based on self-hosted simplicity
- Reverse proxy: Traefik (auto SSL, Docker-native, label-based config)
- Logging: Structured JSON logs to stdout (users pipe to their preferred stack)

### Claude's Discretion
- Multi-tenancy implementation pattern
- Redis usage scope (sessions/cache vs also queues)
- API style choice (REST vs tRPC vs GraphQL)
- Error response format
- Secrets management approach (.env only vs Docker secrets)

</decisions>

<specifics>
## Specific Ideas

- Bun runtime explicitly chosen for its speed and native TypeScript support
- Traefik for auto SSL with Docker labels — minimize manual config for self-hosters
- Both login methods (magic link + password) give users flexibility
- Internal trust between services keeps bot auth simple in Phase 5

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-infrastructure*
*Context gathered: 2026-02-05*

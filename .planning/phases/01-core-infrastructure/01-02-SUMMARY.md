---
phase: 01-core-infrastructure
plan: 02
subsystem: auth
tags: [jwt, argon2, hono, resend, magic-link, rfc7807]

# Dependency graph
requires:
  - phase: 01-01
    provides: Database schema (users, organizations, refresh_tokens), env validation, logger
provides:
  - JWT authentication with access/refresh token pairs
  - Password hashing with Argon2
  - Magic link passwordless authentication
  - RFC 7807 Problem Details error responses
  - Auth middleware for protected routes
  - Complete auth routes (register, login, logout, refresh, magic-link)
affects: [01-03-PLAN, 02-*, all phases needing authenticated endpoints]

# Tech tracking
tech-stack:
  added: [@hono/zod-validator]
  patterns: [jwt-hs256, argon2-password-hashing, rfc7807-errors, token-rotation]

key-files:
  created:
    - src/services/auth.ts
    - src/services/email.ts
    - src/middleware/auth.ts
    - src/middleware/error-handler.ts
    - src/routes/auth/register.ts
    - src/routes/auth/login.ts
    - src/routes/auth/logout.ts
    - src/routes/auth/refresh.ts
    - src/routes/auth/magic-link.ts
    - src/routes/auth/index.ts
    - src/routes/index.ts
    - src/db/schema/magic-links.ts
  modified:
    - src/index.ts
    - src/lib/env.ts
    - src/db/schema/index.ts

key-decisions:
  - "Hono onError handler instead of middleware for error handling (standard Hono pattern)"
  - "Check error.name property instead of instanceof for ApiError detection (more reliable across module boundaries)"
  - "ContentfulStatusCode type for ApiError status to satisfy Hono type system"
  - "Return same message for both existing and non-existing emails on magic link to prevent enumeration"

patterns-established:
  - "Error handling: Throw ApiError with status, type, title, detail; caught by app.onError()"
  - "Route organization: src/routes/{resource}/index.ts barrel exports sub-routes"
  - "Auth middleware: c.set('user', payload) to pass validated user to handlers"
  - "Token rotation: On refresh, delete old token and issue new pair"

# Metrics
duration: 7min
completed: 2026-02-05
---

# Phase 01 Plan 02: Authentication System Summary

**JWT auth with Argon2 password hashing, magic link passwordless login, and RFC 7807 error responses using Hono**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-05T06:01:56Z
- **Completed:** 2026-02-05T06:08:55Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Complete auth flow: register, login, logout with JWT tokens
- Magic link passwordless authentication with email sending via Resend
- Refresh token rotation for security (old token deleted on use)
- RFC 7807 Problem Details error responses for all API errors
- Auth middleware protecting routes with JWT validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth services and error handling middleware** - `717c264` (feat)
2. **Task 2: Create auth routes and middleware** - `951a995` (feat)

## Files Created/Modified
- `src/services/auth.ts` - Password hashing (Argon2), JWT generation/verification, token management
- `src/services/email.ts` - Magic link email sending via Resend
- `src/middleware/auth.ts` - JWT validation middleware for protected routes
- `src/middleware/error-handler.ts` - ApiError class and RFC 7807 error types
- `src/routes/auth/*.ts` - Auth endpoints (register, login, logout, refresh, magic-link)
- `src/routes/index.ts` - Route barrel export
- `src/db/schema/magic-links.ts` - Magic links table schema
- `src/index.ts` - Updated with CORS, error handler, and route mounting
- `src/lib/env.ts` - Added APP_URL for magic link generation

## Decisions Made
- **Hono onError handler:** Used app.onError() instead of middleware pattern for global error handling - this is the standard Hono approach and ensures errors are caught properly
- **Error name check:** Check `err.name === 'ApiError'` instead of `instanceof ApiError` - more reliable across module boundaries in Bun
- **ContentfulStatusCode:** Used Hono's ContentfulStatusCode type for ApiError status to satisfy strict type checking
- **Email enumeration prevention:** Magic link request returns same success message whether email exists or not

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed JWT verify signature**
- **Found during:** Task 1 (auth services)
- **Issue:** Hono JWT verify requires 3 arguments (token, secret, algorithm), plan showed 2
- **Fix:** Added 'HS256' as third argument to verify calls
- **Files modified:** src/services/auth.ts
- **Committed in:** 717c264 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed error handler type compatibility**
- **Found during:** Task 1 (error handler)
- **Issue:** Hono c.json type signature changed, status parameter needed ContentfulStatusCode type
- **Fix:** Changed ApiError.status type to ContentfulStatusCode
- **Files modified:** src/middleware/error-handler.ts
- **Committed in:** 717c264 (Task 1 commit)

**3. [Rule 3 - Blocking] Fixed TypeScript undefined checks**
- **Found during:** Task 2 (register route)
- **Issue:** TypeScript strict mode flagged potentially undefined org/user from insert().returning()
- **Fix:** Added explicit undefined checks with proper error handling
- **Files modified:** src/routes/auth/register.ts
- **Committed in:** 951a995 (Task 2 commit)

**4. [Rule 1 - Bug] Fixed error handler not catching errors**
- **Found during:** Task 2 (testing)
- **Issue:** Using middleware pattern for error handler wasn't catching thrown ApiErrors
- **Fix:** Moved to Hono's app.onError() pattern which is the proper global error handler
- **Files modified:** src/index.ts
- **Committed in:** 951a995 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs)
**Impact on plan:** All auto-fixes necessary for correct operation with Hono's API. No scope creep.

## Issues Encountered
- Initial error handler middleware approach didn't work properly with Hono - errors weren't being caught. Switched to app.onError() which is the documented Hono approach and resolved all error handling issues.

## User Setup Required

**External services require manual configuration.** The plan specifies:
- **RESEND_API_KEY:** Required for magic link emails. Get from https://resend.com/api-keys
- **Domain verification:** For production, verify sending domain in Resend dashboard (currently using default onboarding@resend.dev for testing)

## Next Phase Readiness
- Authentication foundation complete and tested
- All auth endpoints working: register, login, logout, refresh, magic-link
- RFC 7807 error handling ready for all future API errors
- Auth middleware available for protecting future endpoints
- Ready for Phase 01-03 (API implementation)

---
*Phase: 01-core-infrastructure*
*Completed: 2026-02-05*

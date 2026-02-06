---
phase: "07"
plan: "02"
subsystem: "web-authentication"
tags: ["next.js", "jwt", "cookies", "middleware", "auth", "shadcn-ui"]
depends:
  requires: ["07-01"]
  provides: ["auth-flow", "route-protection", "login-pages"]
  affects: ["07-03", "07-04", "07-05"]
tech-stack:
  added: ["react-hook-form", "@hookform/resolvers", "zod", "clsx", "tailwind-merge", "class-variance-authority", "lucide-react", "@radix-ui/react-slot", "@radix-ui/react-label", "@radix-ui/react-toast"]
  patterns: ["HTTP-only cookies for JWT storage", "middleware route protection", "API route proxying", "form validation with zod"]
key-files:
  created:
    - web/middleware.ts
    - web/src/app/api/auth/login/route.ts
    - web/src/app/api/auth/logout/route.ts
    - web/src/app/api/auth/refresh/route.ts
    - web/src/app/api/auth/magic-link/request/route.ts
    - web/src/app/api/auth/magic-link/verify/route.ts
    - web/src/app/(auth)/layout.tsx
    - web/src/app/(auth)/login/page.tsx
    - web/src/app/(auth)/login/login-form.tsx
    - web/src/app/(auth)/magic-link/page.tsx
    - web/src/lib/api.ts
    - web/src/lib/auth.ts
    - web/src/lib/utils.ts
    - web/src/components/ui/button.tsx
    - web/src/components/ui/input.tsx
    - web/src/components/ui/label.tsx
    - web/src/components/ui/card.tsx
  modified:
    - web/package.json
    - web/src/app/globals.css
    - web/components.json
decisions:
  - key: "http-only-cookies"
    value: "JWT tokens stored in HTTP-only cookies for security"
  - key: "api-route-proxy"
    value: "Next.js API routes proxy to backend and manage cookies"
  - key: "middleware-protection"
    value: "Middleware redirects unauthenticated users to /login"
  - key: "shadcn-ui-manual"
    value: "shadcn/ui components created manually due to registry network issues"
metrics:
  duration: "5 min"
  completed: "2026-02-06"
---

# Phase 7 Plan 02: Authentication Flow Summary

JWT cookie auth with login/magic-link pages and middleware route protection using HTTP-only cookies for security.

## What Was Built

### Auth API Routes
Created Next.js API routes that proxy to the backend and manage HTTP-only cookies:
- **POST /api/auth/login** - Authenticates user, sets access_token and refresh_token cookies
- **POST /api/auth/logout** - Calls backend logout, clears cookies
- **POST /api/auth/refresh** - Refreshes tokens via backend, updates cookies
- **POST /api/auth/magic-link/request** - Proxies magic link request to backend
- **GET /api/auth/magic-link/verify** - Verifies magic link token, sets cookies

### Middleware Route Protection
Created `web/middleware.ts` that:
- Allows public paths: `/login`, `/magic-link`, `/api/auth/*`
- Allows static assets and Next.js internals
- Redirects unauthenticated users to `/login` with `callbackUrl` param
- Checks for `access_token` cookie presence (not validation - that happens on API calls)

### Login Page
Created login page at `/login` with:
- Email/password form with react-hook-form and zod validation
- Error display for invalid credentials
- "Send magic link" alternative option
- Redirect to callbackUrl on success

### Magic Link Page
Created verification page at `/magic-link` that:
- Reads `?token=` from URL
- Calls `/api/auth/magic-link/verify`
- Shows success/error state
- Auto-redirects to dashboard on success

### Support Libraries
- `web/src/lib/api.ts` - API client utilities for server and client components
- `web/src/lib/auth.ts` - Auth helpers for server-side cookie access
- `web/src/lib/utils.ts` - Tailwind class merging utility

### UI Components (shadcn/ui)
Manually created base components due to shadcn registry network issues:
- Button, Input, Label, Card components
- Updated globals.css with full design system CSS variables

## Key Implementation Details

### Cookie Security
```typescript
cookieStore.set('access_token', data.accessToken, {
  httpOnly: true,      // Not accessible via JavaScript
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 15,     // 15 minutes for access token
  path: '/',
});
```

### Middleware Pattern
```typescript
const token = request.cookies.get('access_token')?.value;
if (!token) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(loginUrl);
}
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| HTTP-only cookies | XSS protection - JavaScript cannot read tokens |
| API route proxying | Cookie management happens server-side |
| Middleware protection | Fast edge execution, runs before render |
| Manual shadcn/ui | Registry network issues during execution |
| 15min/7day expiry | Standard access/refresh token lifetimes |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing @radix-ui/react-toast dependency**
- **Found during:** Task 3 verification
- **Issue:** Build failed due to toast component from 07-01 requiring radix toast
- **Fix:** Installed @radix-ui/react-toast
- **Files modified:** web/package.json, web/package-lock.json
- **Commit:** Included in Task 3 commit

**2. [Rule 2 - Missing Critical] shadcn/ui manual setup**
- **Found during:** Task 1 setup
- **Issue:** shadcn CLI init failed due to ui.shadcn.com network issues
- **Fix:** Manually installed dependencies and created components
- **Files modified:** web/package.json, web/src/components/ui/*
- **Commit:** Included in Task 1 commit

## Verification

- [x] `npm run build` completes successfully
- [x] Middleware protects all routes except public paths
- [x] Login page displays with email/password form
- [x] Login form validates input and shows errors
- [x] Magic link request and verification routes exist
- [x] TypeScript compiles without errors

## Next Phase Readiness

Ready for Phase 07-03 (Dashboard Layout):
- Auth flow complete and functional
- Middleware protecting dashboard routes
- Cookie management in place
- API client utilities available

**Blockers:** None
**Concerns:** None

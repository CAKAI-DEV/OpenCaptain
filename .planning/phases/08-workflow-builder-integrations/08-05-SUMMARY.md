---
phase: 08-workflow-builder-integrations
plan: 05
subsystem: integrations
tags: [github-app, octokit, bullmq, coding-agent, pr-automation]

# Dependency graph
requires:
  - phase: 08-02
    provides: Linear integration patterns for external service auth
  - phase: 03-llm-infrastructure
    provides: LLM chat completion for fix analysis
provides:
  - GitHub App integration with installation token auth
  - Coding agent service for automated PR creation
  - Linked repos schema for project-repo associations
  - Role-based authorization for coding fix requests
affects: [future-coding-features, ai-automation]

# Tech tracking
tech-stack:
  added: ["@octokit/rest", "@octokit/auth-app"]
  patterns: ["GitHub App installation auth", "Draft PR for human review", "Role-tier authorization"]

key-files:
  created:
    - src/features/integrations/github/github.app.ts
    - src/features/integrations/github/github.client.ts
    - src/features/integrations/github/github.types.ts
    - src/features/coding-agent/coding-agent.service.ts
    - src/features/coding-agent/coding-agent.routes.ts
    - src/features/coding-agent/coding-agent.worker.ts
    - src/shared/db/schema/github-repos.ts
  modified:
    - src/index.ts
    - src/shared/lib/env.ts
    - src/shared/lib/queue/client.ts

key-decisions:
  - "Fresh installation token per operation (no caching)"
  - "Draft PR only - never auto-merge"
  - "Role tier <= 2 (admin/pm/squad_lead) required for fix authorization"
  - "LLM generates fix analysis, not actual code changes (MVP)"
  - "Centralized codingAgentQueue in queue/client.ts"

patterns-established:
  - "GitHub App auth: createGitHubAppClient generates fresh token each call"
  - "Role authorization: getRoleTier() < threshold pattern for permission checks"
  - "Worker concurrency: 1 for rate-limited external APIs"

# Metrics
duration: 8min
completed: 2026-02-06
---

# Phase 8 Plan 5: GitHub App & Coding Agent Summary

**GitHub App integration with Octokit for automated draft PR creation, role-based authorization, and BullMQ async processing**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-06T14:03:22Z
- **Completed:** 2026-02-06T14:11:49Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- GitHub App authentication with installation token generation via @octokit/auth-app
- Coding agent service that validates role authorization and queues PR creation jobs
- API routes for repo linking (admin) and fix requests (lead/admin/pm)
- BullMQ worker with concurrency 1 for rate-limited GitHub API calls
- All PRs created as draft with clear "never auto-merge" policy

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub App integration** - `d3cbefe` (feat)
2. **Task 2: Implement coding agent service** - `555aa16` (feat)
3. **Task 3: Add coding agent routes and worker** - `94d21a2` (feat)

## Files Created/Modified
- `src/features/integrations/github/github.app.ts` - GitHub App auth with installation tokens
- `src/features/integrations/github/github.client.ts` - Octokit wrappers for branches/PRs
- `src/features/integrations/github/github.types.ts` - TypeScript interfaces
- `src/features/coding-agent/coding-agent.service.ts` - Core service with requestCodingFix, processCodingRequest
- `src/features/coding-agent/coding-agent.routes.ts` - API endpoints for repos and fix requests
- `src/features/coding-agent/coding-agent.worker.ts` - BullMQ worker (concurrency 1)
- `src/shared/db/schema/github-repos.ts` - linkedRepos and codingRequests tables
- `src/shared/lib/env.ts` - GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY env vars
- `src/shared/lib/queue/client.ts` - codingAgentQueue added
- `src/index.ts` - Routes mounted and worker imported

## Decisions Made
- Fresh installation token per operation - GitHub tokens expire in 1 hour, generating fresh avoids stale token issues
- Role tier threshold of 2 - Admin (0), PM (1), Squad Lead (2) can authorize; Members (3) cannot
- Draft PR only - All PRs created with draft: true, never auto-merge
- LLM analysis only - For MVP, agent generates fix description, not actual code changes
- Centralized queue - codingAgentQueue defined in shared/lib/queue/client.ts like other queues

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed insights.routes.ts import path**
- **Found during:** Task 1 (Pre-existing error on typecheck)
- **Issue:** Import from '../../shared/lib/errors' which doesn't exist
- **Fix:** Changed to import from '../../shared/middleware'
- **Files modified:** src/features/insights/insights.routes.ts
- **Committed in:** d3cbefe (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Pre-existing bug fix, no scope creep.

## Issues Encountered
None - plan executed smoothly after fixing pre-existing import error.

## User Setup Required

**External services require manual configuration.** To enable coding agent:

1. **Create GitHub App:**
   - GitHub Settings -> Developer Settings -> GitHub Apps -> New GitHub App
   - Set permissions: Contents (Read & Write), Pull requests (Read & Write)
   - Generate and download private key (.pem file)

2. **Add environment variables:**
   ```
   GITHUB_APP_ID=your-app-id
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...contents...\n-----END RSA PRIVATE KEY-----"
   ```

3. **Install App on repositories:**
   - GitHub App -> Install App -> Select organization/repositories

## Next Phase Readiness
- GitHub App integration complete for PR creation
- Coding agent ready for authorized users to request fixes
- Phase 8 (Workflow Builder & Integrations) complete - all 5 plans executed

---
*Phase: 08-workflow-builder-integrations*
*Completed: 2026-02-06*

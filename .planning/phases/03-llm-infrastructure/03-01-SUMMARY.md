---
phase: 03-llm-infrastructure
plan: 01
subsystem: llm
tags: [litellm, openai-sdk, docker, llm-proxy, embeddings]

# Dependency graph
requires:
  - phase: 01-core-infrastructure
    provides: Docker Compose, env.ts schema, database setup
  - phase: 02-team-access
    provides: Organizations table
provides:
  - LiteLLM Docker container for LLM abstraction
  - OpenAI SDK client wrapper for LiteLLM
  - chatCompletion and generateEmbedding functions
  - Organization LLM model preferences (llmModel, llmFallbackModel)
  - chatCompletionForOrg with automatic fallback
affects: [03-02-memory, 03-03-rag, 04-agent-core, 05-conversations]

# Tech tracking
tech-stack:
  added: [openai@6.17.0, litellm:main-v1.55.0, pgvector/pgvector:pg16]
  patterns: [LiteLLM proxy abstraction, OpenAI SDK wrapper, single-fallback model strategy]

key-files:
  created:
    - litellm-config.yaml
    - src/features/llm/llm.types.ts
    - src/features/llm/llm.client.ts
    - src/features/llm/llm.service.ts
    - src/features/llm/index.ts
    - src/shared/db/migrations/0006_chilly_wendigo.sql
  modified:
    - docker-compose.yml
    - src/shared/lib/env.ts
    - src/shared/db/schema/organizations.ts

key-decisions:
  - "Port 4010 for LiteLLM (4000/4001 already in use by other Docker services)"
  - "Upgraded postgres image to pgvector/pgvector:pg16 for future vector support"
  - "Non-retryable errors (400/401/403/404) trigger fallback, retryable errors (429/5xx) re-throw"
  - "Client created per-request (not singleton) for flexibility"

patterns-established:
  - "LLM client factory pattern: createLLMClient() returns configured OpenAI instance"
  - "Organization model preference pattern: fetch org settings, use as default, fallback on error"
  - "Single fallback strategy: primary model -> fallback model -> error (no retry loops)"

# Metrics
duration: 8min
completed: 2026-02-05
---

# Phase 3 Plan 1: LiteLLM + LLM Client Setup Summary

**LiteLLM proxy deployed via Docker with OpenAI SDK wrapper and organization-configurable model preferences**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-05T13:53:34Z
- **Completed:** 2026-02-05T14:01:29Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- LiteLLM container running on port 4010 with health checks
- OpenAI SDK client configured to proxy through LiteLLM
- chatCompletion, generateEmbedding, and chatCompletionForOrg functions
- Organizations have llmModel and llmFallbackModel columns with defaults
- Single fallback strategy on non-retryable errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add LiteLLM to Docker Compose** - `970b737` (feat)
2. **Task 2: Create LLM Client and Service** - `3300aa9` (feat)
3. **Task 3: Add Organization Model Preference** - `0ae691b` (feat)

## Files Created/Modified

- `litellm-config.yaml` - Model configuration for LiteLLM proxy
- `docker-compose.yml` - Added litellm service, upgraded postgres to pgvector image
- `src/shared/lib/env.ts` - Added LITELLM_URL, LITELLM_API_KEY, optional provider keys
- `src/features/llm/llm.types.ts` - ChatMessage, ChatCompletionResult, EmbeddingResult types
- `src/features/llm/llm.client.ts` - createLLMClient factory function
- `src/features/llm/llm.service.ts` - chatCompletion, generateEmbedding, chatCompletionForOrg
- `src/features/llm/index.ts` - Barrel export for llm feature
- `src/shared/db/schema/organizations.ts` - Added llmModel, llmFallbackModel columns
- `src/shared/db/migrations/0006_chilly_wendigo.sql` - Migration for new columns

## Decisions Made

1. **Port 4010 for LiteLLM** - Ports 4000 and 4001 were already allocated by other Docker containers
2. **pgvector postgres image** - Upgraded from postgres:16-alpine to pgvector/pgvector:pg16 in anticipation of RAG features
3. **Single fallback strategy** - On non-retryable errors (model not found, auth errors), try fallback once then error; retryable errors (rate limits) re-throw without fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed LiteLLM port from 4000 to 4010**
- **Found during:** Task 1 (Docker Compose setup)
- **Issue:** Ports 4000 and 4001 were already allocated by other Docker services
- **Fix:** Changed exposed port to 4010, updated env.ts default
- **Files modified:** docker-compose.yml, src/shared/lib/env.ts
- **Verification:** Container starts successfully, health check passes
- **Committed in:** 970b737

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor port change required due to environment constraints. No scope creep.

## Issues Encountered

None - plan executed smoothly after resolving port conflict.

## User Setup Required

**External services require manual configuration.** Environment variables needed:

| Variable | Description | Source |
|----------|-------------|--------|
| LITELLM_MASTER_KEY | Master key for LiteLLM proxy | Generate 32+ char random string |
| LITELLM_SALT_KEY | Salt key for LiteLLM | Generate 32+ char random string |
| LITELLM_API_KEY | Same as LITELLM_MASTER_KEY | Use master key value |
| OPENAI_API_KEY | OpenAI API key (optional) | OpenAI Dashboard |
| ANTHROPIC_API_KEY | Anthropic API key (optional) | Anthropic Console |

Add to `.env`:
```
LITELLM_MASTER_KEY=your-secure-key-here
LITELLM_SALT_KEY=your-secure-salt-here
LITELLM_API_KEY=your-secure-key-here
OPENAI_API_KEY=sk-...  # Optional
ANTHROPIC_API_KEY=sk-ant-...  # Optional
```

Verify with: `curl http://localhost:4010/health/liveliness`

## Next Phase Readiness

- LLM client layer ready for use in memory and RAG features
- Organization model preferences stored and queryable
- All TypeScript types properly defined for downstream use
- No blockers for 03-02 (Memory System) or 03-03 (RAG/pgvector)

---
*Phase: 03-llm-infrastructure*
*Completed: 2026-02-05*

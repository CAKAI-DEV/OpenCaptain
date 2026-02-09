import { test as base } from '@playwright/test';
import { execSync } from 'node:child_process';

/**
 * Flush Redis rate-limit keys so tests don't get 429 responses.
 */
function flushRateLimits() {
  try {
    execSync('docker compose exec -T redis redis-cli EVAL "for _,k in ipairs(redis.call(\'keys\',\'ratelimit:*\')) do redis.call(\'del\',k) end" 0', {
      stdio: 'ignore',
      timeout: 5_000,
    });
  } catch {
    // Ignore errors (e.g. no matching keys, docker not available)
  }
}

/**
 * Extended Playwright test that flushes rate limits before each test.
 * This prevents the API rate limiter (100 req/60s) from blocking
 * later tests in the suite.
 */
export const test = base.extend({
  // Auto-use fixture that flushes rate limits before each test
  // eslint-disable-next-line no-empty-pattern
  _flushRateLimits: [async ({}, use) => {
    flushRateLimits();
    await use(undefined);
  }, { auto: true }],
});

export { expect } from '@playwright/test';

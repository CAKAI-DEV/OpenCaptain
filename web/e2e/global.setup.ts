import { test as setup, expect } from '@playwright/test';

setup('authenticate as admin', async ({ page }) => {
  // Verify the app is reachable
  await page.goto('/login');
  await expect(page.locator('h1')).toContainText('Welcome back');

  // Fill login form
  await page.getByLabel('Email').fill('admin@acme.dev');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for redirect to /projects
  await page.waitForURL('**/projects', { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();

  // Save storage state (captures httpOnly cookies)
  await page.context().storageState({ path: './e2e/.auth/admin.json' });
});

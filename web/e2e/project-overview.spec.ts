import { test, expect } from './helpers/fixtures';
import { navigateToProject } from './helpers/navigation';

test.describe('Project Overview', () => {
  test('shows project name as heading', async ({ page }) => {
    await navigateToProject(page);
    await expect(page.getByRole('heading', { name: 'BlockBot v2' })).toBeVisible();
  });

  test('shows health cards', async ({ page }) => {
    await navigateToProject(page);
    await expect(page.getByText('Velocity (7d)')).toBeVisible();
    await expect(page.getByText('Completed', { exact: true })).toBeVisible();
    await expect(page.getByText('Active Squads')).toBeVisible();
    await expect(page.getByText('Active Members')).toBeVisible();
  });

  test('quick access links navigate correctly', async ({ page }) => {
    await navigateToProject(page);
    await expect(page.getByText('Quick Access')).toBeVisible();

    // Verify quick links exist
    const quickLinks = ['Board', 'List', 'Team', 'Workflows'];
    for (const linkName of quickLinks) {
      await expect(page.locator('a').filter({ hasText: linkName }).first()).toBeVisible();
    }

    // Click Board link and verify navigation
    await page.locator('a').filter({ hasText: 'Board' }).first().click();
    await page.waitForURL('**/board');
    await expect(page.getByRole('heading', { name: 'Board' })).toBeVisible();
  });
});

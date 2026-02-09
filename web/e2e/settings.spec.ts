import { test, expect } from './helpers/fixtures';

test.describe('Settings', () => {
  test('profile settings page loads with heading', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Profile Settings' })).toBeVisible();
  });

  test('settings sidebar has navigation links', async ({ page }) => {
    await page.goto('/settings');
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: 'Profile' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Organization' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Team' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Notifications' })).toBeVisible();
  });

  test('navigation to organization settings works', async ({ page }) => {
    await page.goto('/settings');
    await page.locator('aside').getByRole('link', { name: 'Organization' }).click();
    await page.waitForURL('**/settings/organization');
  });

  test('navigation to team settings works', async ({ page }) => {
    await page.goto('/settings');
    await page.locator('aside').getByRole('link', { name: 'Team' }).click();
    await page.waitForURL('**/settings/team');
  });
});

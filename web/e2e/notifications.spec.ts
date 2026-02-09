import { test, expect } from './helpers/fixtures';

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notifications');
  });

  test('notifications page shows heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  });

  test('all/unread filter buttons are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Unread/i })).toBeVisible();
  });

  test('shows notification list or empty state after loading', async ({ page }) => {
    // Wait for loading skeletons to disappear
    await page.waitForTimeout(3_000);
    // Either notifications are listed or empty state is shown
    const hasNotifications = await page.locator('[data-slot="card"]').count() > 0;
    const hasEmptyState = await page.getByText(/No notifications/i).isVisible().catch(() => false);
    expect(hasNotifications || hasEmptyState).toBeTruthy();
  });
});

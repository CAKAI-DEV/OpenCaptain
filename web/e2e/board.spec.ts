import { test, expect } from './helpers/fixtures';
import { navigateToProject, navigateToSubPage } from './helpers/navigation';

test.describe('Board', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProject(page);
    await navigateToSubPage(page, 'Board');
    await page.waitForURL('**/board');
  });

  test('board page shows heading and columns', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Board' })).toBeVisible();
    await expect(page.getByText('To Do')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('task cards render from seed data', async ({ page }) => {
    // Wait for cards to appear - at least one card should be visible
    const cards = page.locator('[class*="cursor-grab"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('task cards show priority badges', async ({ page }) => {
    // Priority badges should be present on cards
    const priorities = page.locator('[class*="cursor-grab"]').locator('.inline-flex');
    await expect(priorities.first()).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a card opens task detail sheet', async ({ page }) => {
    const card = page.locator('[class*="cursor-grab"]').first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    // Sheet/dialog should appear
    await expect(page.getByRole('dialog').or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 5_000 });
  });

  test('new task button opens create dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new task/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Title')).toBeVisible();
  });
});

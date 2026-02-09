import { test, expect } from './helpers/fixtures';
import { navigateToProject, navigateToSubPage } from './helpers/navigation';

test.describe('Deliverables', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProject(page);
    await navigateToSubPage(page, 'Deliverables');
    await page.waitForURL('**/deliverables');
  });

  test('deliverables page shows heading and action buttons', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Deliverables' })).toBeVisible();
    await expect(page.getByRole('button', { name: /new deliverable/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add type/i })).toBeVisible();
  });

  test('add type dialog shows presets', async ({ page }) => {
    await page.getByRole('button', { name: /add type/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Blog Post')).toBeVisible();
    await expect(page.getByText('Social Media')).toBeVisible();
    await expect(page.getByText('Video')).toBeVisible();
  });

  test('shows deliverables or empty state', async ({ page }) => {
    // Wait for loading to finish
    await expect(page.locator('.animate-pulse').first()).toBeHidden({ timeout: 10_000 });
    // Either deliverables cards or empty state
    const hasDeliverables = await page.locator('[class*="hover:shadow"]').count() > 0;
    const hasEmptyState = await page.getByText('No deliverables yet').isVisible();
    expect(hasDeliverables || hasEmptyState).toBeTruthy();
  });
});

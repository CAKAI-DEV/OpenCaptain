import { test, expect } from './helpers/fixtures';
import { navigateToProject, navigateToSubPage } from './helpers/navigation';

test.describe('List', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProject(page);
    await navigateToSubPage(page, 'List');
    await page.waitForURL('**/list');
  });

  test('list page shows Tasks heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  });

  test('table has rows from seed data', async ({ page }) => {
    // Wait for task list to load (Suspense boundary resolves)
    await page.waitForTimeout(2_000);
    // There should be task content visible (cards or table rows)
    const taskElements = page.locator('[class*="border"]').filter({ hasText: /.+/ });
    const count = await taskElements.count();
    expect(count).toBeGreaterThan(1);
  });

  test('search and filter inputs are present', async ({ page }) => {
    // Search input and filter selects should be visible
    await expect(page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').or(page.getByRole('searchbox'))).toBeVisible({ timeout: 10_000 });
  });

  test('status filter has To Do / In Progress / Done options', async ({ page }) => {
    // Click the status select trigger (the one showing "All Statuses")
    const statusTrigger = page.getByRole('combobox').filter({ hasText: /Status/i }).first();
    await expect(statusTrigger).toBeVisible({ timeout: 10_000 });
    await statusTrigger.click();

    // Radix Select options appear in a portal with role="listbox"
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    await expect(listbox.getByText('To Do')).toBeVisible();
    await expect(listbox.getByText('In Progress')).toBeVisible();
    await expect(listbox.getByText('Done')).toBeVisible();
  });
});

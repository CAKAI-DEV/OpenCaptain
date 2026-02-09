import { test, expect } from './helpers/fixtures';

test.describe('Projects', () => {
  test('projects page shows heading and description', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    await expect(page.getByText('Manage your projects and tasks')).toBeVisible();
  });

  test('BlockBot v2 project card is visible', async ({ page }) => {
    await page.goto('/projects');
    // Server-side fetch may occasionally fail; retry with a reload
    const card = page.getByText('BlockBot v2');
    if (!(await card.isVisible().catch(() => false))) {
      await page.reload();
    }
    await expect(card).toBeVisible({ timeout: 10_000 });
  });

  test('clicking project card navigates to project overview', async ({ page }) => {
    await page.goto('/projects');
    const card = page.getByText('BlockBot v2');
    if (!(await card.isVisible().catch(() => false))) {
      await page.reload();
    }
    await card.click();
    await page.waitForURL('**/projects/*');
    await expect(page.url()).toMatch(/\/projects\/[a-zA-Z0-9-]+$/);
  });

  test('create project button opens dialog', async ({ page }) => {
    await page.goto('/projects');
    // There may be two "New Project" buttons (header + empty state); use .first()
    await page.getByRole('button', { name: /new project/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

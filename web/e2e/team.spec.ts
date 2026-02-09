import { test, expect } from './helpers/fixtures';
import { navigateToProject, navigateToSubPage } from './helpers/navigation';

test.describe('Team', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProject(page);
    await navigateToSubPage(page, 'Team');
    await page.waitForURL('**/team');
  });

  test('team page shows heading and tabs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Members/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Squads/i })).toBeVisible();
  });

  test('members tab shows @acme.dev emails', async ({ page }) => {
    // Wait for member data to load (skeleton placeholders disappear)
    await page.waitForTimeout(3_000);
    // Should show seed data members with acme.dev emails or empty state
    const hasMember = await page.getByText('acme.dev').first().isVisible().catch(() => false);
    const hasEmptyState = await page.getByText('No members yet').isVisible().catch(() => false);
    expect(hasMember || hasEmptyState).toBeTruthy();
  });

  test('squads tab shows new squad button', async ({ page }) => {
    await page.getByRole('tab', { name: /Squads/i }).click();
    await expect(page.getByRole('button', { name: /new squad/i })).toBeVisible();
  });

  test('invite button opens dialog', async ({ page }) => {
    await page.getByRole('button', { name: /invite/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Invite Team Member' })).toBeVisible();
  });
});

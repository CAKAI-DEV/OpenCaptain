import { test, expect } from './helpers/fixtures';
import { navigateToProject, navigateToSubPage } from './helpers/navigation';

test.describe('Check-ins & Escalations', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProject(page);
    await navigateToSubPage(page, 'Check-ins');
    await page.waitForURL('**/checkins');
  });

  test('page shows heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Check-ins & Escalations' })).toBeVisible();
  });

  test('three tabs are visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Check-ins/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Escalations/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Blockers/i })).toBeVisible();
  });

  test('new check-in button opens dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new check-in/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Create Check-in')).toBeVisible();
  });

  test('escalations tab shows new escalation button', async ({ page }) => {
    await page.getByRole('tab', { name: /Escalations/i }).click();
    await expect(page.getByRole('button', { name: /new escalation/i })).toBeVisible();
  });

  test('blockers tab shows report blocker button and opens dialog', async ({ page }) => {
    await page.getByRole('tab', { name: /Blockers/i }).click();
    const reportBtn = page.getByRole('button', { name: /report blocker/i });
    await expect(reportBtn).toBeVisible();
    await reportBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Report Blocker' })).toBeVisible();
  });
});

import { expect, type Page } from '@playwright/test';

export async function navigateToProject(page: Page): Promise<string> {
  // Server-side fetch may occasionally fail (rate limiting, caching).
  // Retry up to 3 times with reloads.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();

    const card = page.getByText('BlockBot v2');
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForURL('**/projects/*');
      const url = page.url();
      const match = url.match(/\/projects\/([^/]+)/);
      return match?.[1] ?? '';
    }

    // Wait before retry to let rate limits reset and server-side caching expire
    await page.waitForTimeout(2_000);
  }

  // Final attempt — will throw if card still not visible
  await page.goto('/projects');
  await page.getByText('BlockBot v2').click();
  await page.waitForURL('**/projects/*');
  const url = page.url();
  const match = url.match(/\/projects\/([^/]+)/);
  return match?.[1] ?? '';
}

export async function navigateToSubPage(page: Page, linkName: string) {
  await page.locator('aside').getByRole('link', { name: linkName }).click();
}

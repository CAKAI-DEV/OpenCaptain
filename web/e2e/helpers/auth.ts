import type { Page } from '@playwright/test';

export async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/projects', { timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.request.post('/api/auth/logout');
  await page.goto('/login');
}

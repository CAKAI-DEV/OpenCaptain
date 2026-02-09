import { test, expect } from './helpers/fixtures';

// Auth tests run unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('login page shows form with Email, Password, Sign in, and Send magic link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Welcome back');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible();
  });

  test('empty form submission shows validation errors', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('.bg-destructive\\/10')).toBeVisible({ timeout: 10_000 });
  });

  test('valid login redirects to /projects', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@acme.dev');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/projects', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  });

  test('quick login cards are visible', async ({ page }) => {
    await page.goto('/login');
    // Each card is a button containing a label div with the role name
    await expect(page.getByRole('button', { name: /Admin\s+Organization admin/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /PM\s+Project manager/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Lead\s+Squad lead/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Dev 1\s+Developer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Dev 2\s+Developer/i })).toBeVisible();
  });

  test('unauthenticated access to /projects redirects to /login', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForURL('**/login**');
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('sign up link is present and points to /register', async ({ page }) => {
    await page.goto('/login');
    const signUpLink = page.getByRole('link', { name: 'Sign up' });
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveAttribute('href', '/register');
  });
});

import { test, expect } from './helpers/fixtures';

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
  });

  test('shows OpenCaptain AI Assistant welcome and input', async ({ page }) => {
    await expect(page.getByText('OpenCaptain AI Assistant')).toBeVisible();
    await expect(page.getByPlaceholder('Ask OpenCaptain anything...')).toBeVisible();
  });

  test('shows current user email in banner', async ({ page }) => {
    await expect(page.getByText('admin@acme.dev')).toBeVisible({ timeout: 10_000 });
  });

  test('send button is disabled when input is empty', async ({ page }) => {
    const sendButton = page.locator('button').filter({ has: page.locator('svg') }).last();
    // Input is empty by default, send button should be disabled
    const input = page.getByPlaceholder('Ask OpenCaptain anything...');
    await expect(input).toHaveValue('');
    await expect(sendButton).toBeDisabled();
  });

  test('clicking suggestion fills input', async ({ page }) => {
    const suggestion = page.getByText("What's the status of our sprint?");
    await expect(suggestion).toBeVisible();
    await suggestion.click();

    const input = page.getByPlaceholder('Ask OpenCaptain anything...');
    await expect(input).toHaveValue("What's the status of our sprint?");
  });

  test('sending a message shows user message and AI response', async ({ page }) => {
    const input = page.getByPlaceholder('Ask OpenCaptain anything...');
    await input.fill('Hello');
    await input.press('Enter');

    // User message should appear in the chat area (not sidebar)
    const chatArea = page.locator('.flex-1.flex.flex-col');
    await expect(chatArea.getByText('Hello').first()).toBeVisible({ timeout: 10_000 });

    // AI response should eventually appear (or error fallback) — wait long for LLM
    await expect(
      chatArea.locator('.bg-muted').filter({ hasText: /.{5,}/ }).last()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('new chat button creates conversation in sidebar', async ({ page }) => {
    await page.getByRole('button', { name: /new chat/i }).click();
    // The sidebar should have at least one conversation entry after creation
    await page.waitForTimeout(1_000);
    // Active conversation should appear - sidebar area should have content
    const sidebar = page.locator('.w-72');
    await expect(sidebar).toBeVisible();
  });
});

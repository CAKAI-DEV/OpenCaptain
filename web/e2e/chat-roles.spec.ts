import { test, expect } from './helpers/fixtures';
import { loginAs } from './helpers/auth';

/**
 * Helper: send a chat message and wait for the AI response.
 * Intercepts API responses for diagnostics.
 * Returns the text content of the AI response.
 */
async function sendAndWaitForResponse(page: import('@playwright/test').Page, message: string) {
  const input = page.getByPlaceholder('Ask BlockBot anything...');
  await expect(input).toBeVisible({ timeout: 10_000 });

  await input.fill(message);

  // Use Promise.all to press Enter AND wait for the conversation creation response
  const [response] = await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/conversations') && resp.request().method() === 'POST',
      { timeout: 15_000 }
    ),
    input.press('Enter'),
  ]);

  // If conversation creation failed, give actionable error
  if (!response.ok()) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Conversation API returned ${response.status()}: ${body}`
    );
  }

  // Wait for AI response (longer timeout for LLM call)
  const aiResponse = page.locator('.bg-muted').filter({ hasText: /.{10,}/ }).last();
  await expect(aiResponse).toBeVisible({ timeout: 45_000 });

  return (await aiResponse.textContent()) ?? '';
}

// ---------------------------------------------------------------------------
// Part 1: Verify every role can access chat and see their email
// ---------------------------------------------------------------------------
const ROLES = [
  { email: 'admin@acme.dev', label: 'Admin' },
  { email: 'pm@acme.dev', label: 'PM' },
  { email: 'lead@acme.dev', label: 'Lead' },
  { email: 'dev1@acme.dev', label: 'Dev 1' },
  { email: 'dev2@acme.dev', label: 'Dev 2' },
];

for (const role of ROLES) {
  test.describe(`Chat as ${role.label}`, () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test(`shows correct user email in banner`, async ({ page }) => {
      await loginAs(page, role.email);
      await page.goto('/chat');
      await expect(page.getByText(role.email)).toBeVisible({ timeout: 10_000 });
    });

    test('can send message and get AI response', async ({ page }) => {
      await loginAs(page, role.email);
      await page.goto('/chat');
      await expect(page.getByText(role.email)).toBeVisible({ timeout: 10_000 });
      await sendAndWaitForResponse(page, 'Hello');
    });

    test('AI response references project data', async ({ page }) => {
      await loginAs(page, role.email);
      await page.goto('/chat');
      await expect(page.getByText(role.email)).toBeVisible({ timeout: 10_000 });

      const responseText = await sendAndWaitForResponse(
        page, "What's the status of our sprint?"
      );

      const projectKeywords = [
        'BlockBot', 'todo', 'in_progress', 'done',
        'task', 'overdue', 'blocker', 'team',
        'admin@acme.dev', 'pm@acme.dev', 'lead@acme.dev',
        'dev1@acme.dev', 'dev2@acme.dev',
      ];
      const hasProjectData = projectKeywords.some(
        (kw) => responseText.toLowerCase().includes(kw.toLowerCase())
      );
      expect(hasProjectData).toBe(true);
    });
  });
}

// ---------------------------------------------------------------------------
// Part 2: Deep project-data tests (admin with fresh login to avoid stale auth)
// ---------------------------------------------------------------------------
test.describe('Chat project-aware responses (Admin)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('sprint status mentions real tasks', async ({ page }) => {
    await loginAs(page, 'admin@acme.dev');
    await page.goto('/chat');
    const text = await sendAndWaitForResponse(page, "What's the status of our sprint?");
    const lower = text.toLowerCase();
    const mentionsTaskData = ['todo', 'in_progress', 'in progress', 'done', 'task'].some(
      (kw) => lower.includes(kw)
    );
    expect(mentionsTaskData).toBe(true);
  });

  test('overdue tasks question returns relevant data', async ({ page }) => {
    await loginAs(page, 'admin@acme.dev');
    await page.goto('/chat');
    const text = await sendAndWaitForResponse(page, 'Show me overdue tasks');
    const lower = text.toLowerCase();
    const mentionsOverdue = [
      'api doc', 'file upload', 'overdue', 'past due', 'late',
    ].some((kw) => lower.includes(kw));
    expect(mentionsOverdue).toBe(true);
  });

  test('team question returns member info', async ({ page }) => {
    await loginAs(page, 'admin@acme.dev');
    await page.goto('/chat');
    const text = await sendAndWaitForResponse(page, 'Who is on the team?');
    const lower = text.toLowerCase();
    const mentionsTeam = [
      'acme.dev', 'admin', 'pm', 'squad_lead', 'squad lead', 'member',
    ].some((kw) => lower.includes(kw));
    expect(mentionsTeam).toBe(true);
  });

  test('blocker question returns relevant data', async ({ page }) => {
    await loginAs(page, 'admin@acme.dev');
    await page.goto('/chat');
    const text = await sendAndWaitForResponse(page, 'Are there any blockers?');
    const lower = text.toLowerCase();
    const mentionsBlockers = [
      'blocker', 'block', 'design spec', 'redis', 'drag handle',
    ].some((kw) => lower.includes(kw));
    expect(mentionsBlockers).toBe(true);
  });
});

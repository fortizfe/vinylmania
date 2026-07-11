import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import { getActiveTheme } from '../helpers/theme';

test.describe('Theme preference toggle (US1)', () => {
  test('toggling the Preferences switch changes the whole app theme instantly, with matching artwork', async ({
    page,
  }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page, {
      displayName: 'Theme Toggle User',
      email: 'e2e-theme-toggle@example.com',
    });

    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();

    const preferences = page.getByRole('region', { name: 'Preferences' });
    await expect(preferences).toBeVisible();

    const toggle = preferences.getByRole('switch', { name: /dark mode/i });
    await expect(toggle).toBeVisible();

    expect(await getActiveTheme(page)).toBe('light');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('theme-toggle-sun-artwork')).toBeVisible();

    const appShell = page.getByTestId('app-shell');
    const lightBackground = await appShell.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );

    await toggle.click();

    // The whole app re-themes instantly (FR-004), not just the toggle.
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('theme-toggle-moon-artwork')).toBeVisible();
    expect(await getActiveTheme(page)).toBe('dark');
    const darkBackground = await appShell.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(darkBackground).not.toBe(lightBackground);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await getActiveTheme(page)).toBe('light');
  });
});

test.describe('Theme preference persistence (US2)', () => {
  test('persists across a reload with no visible flash of the wrong theme', async ({ page }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page, {
      displayName: 'Reload Persistence User',
      email: 'e2e-theme-reload@example.com',
    });

    await page.getByRole('link', { name: 'Profile' }).click();
    const toggle = page
      .getByRole('region', { name: 'Preferences' })
      .getByRole('switch', { name: /dark mode/i });
    const saved = page.waitForResponse(
      (res) => res.url().includes('/api/auth/preferences') && res.request().method() === 'PATCH',
    );
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    // Wait for the real Firestore write to land before reloading, so this
    // checks real persistence rather than only the local paint-ahead cache.
    await saved;

    await page.reload();

    // FR-015/SC-002: the correct theme is already applied at first paint —
    // no observable flash of light mode before the app finishes loading.
    expect(await getActiveTheme(page)).toBe('dark');
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
    const reloadedToggle = page
      .getByRole('region', { name: 'Preferences' })
      .getByRole('switch', { name: /dark mode/i });
    await expect(reloadedToggle).toHaveAttribute('aria-checked', 'true');
  });

  test('follows the account to a fresh browser context (a different device/session)', async ({
    page,
    browser,
  }) => {
    const email = 'e2e-theme-cross-device@example.com';

    await page.goto('/');
    await signInAsFakeGoogleUser(page, { displayName: 'Cross Device User', email });
    await page.getByRole('link', { name: 'Profile' }).click();
    const toggle = page
      .getByRole('region', { name: 'Preferences' })
      .getByRole('switch', { name: /dark mode/i });
    const saved = page.waitForResponse(
      (res) => res.url().includes('/api/auth/preferences') && res.request().method() === 'PATCH',
    );
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await saved;

    // A fresh context has empty localStorage/cookies — simulates a
    // different device/browser signing in with the same account.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.goto('/');
    await signInAsFakeGoogleUser(otherPage, { displayName: 'Cross Device User', email });
    await otherPage.getByRole('link', { name: 'Profile' }).click();

    await expect(otherPage.getByRole('heading', { name: /profile/i })).toBeVisible();
    const otherToggle = otherPage
      .getByRole('region', { name: 'Preferences' })
      .getByRole('switch', { name: /dark mode/i });
    await expect(otherToggle).toHaveAttribute('aria-checked', 'true');
    expect(await getActiveTheme(otherPage)).toBe('dark');

    await otherContext.close();
  });

  test('falls back to the OS setting for a brand-new user who has never set a preference', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });

    await page.goto('/');
    await signInAsFakeGoogleUser(page, {
      displayName: 'Fresh User',
      email: 'e2e-theme-fresh-user@example.com',
    });

    expect(await getActiveTheme(page)).toBe('dark');

    await page.getByRole('link', { name: 'Profile' }).click();
    const toggle = page
      .getByRole('region', { name: 'Preferences' })
      .getByRole('switch', { name: /dark mode/i });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('shows a non-blocking notice when saving the preference ultimately fails', async ({
    page,
  }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page, {
      displayName: 'Save Failure User',
      email: 'e2e-theme-save-failure@example.com',
    });

    await page.getByRole('link', { name: 'Profile' }).click();
    await page.route('**/api/auth/preferences', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal_error', message: 'Simulated failure' }),
      });
    });

    const toggle = page
      .getByRole('region', { name: 'Preferences' })
      .getByRole('switch', { name: /dark mode/i });
    await toggle.click();

    // The theme still applies locally immediately, even though the save
    // will ultimately fail after retries (FR-010).
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(await getActiveTheme(page)).toBe('dark');

    // Retries (research.md R4a: 1s, 2s, 4s) must exhaust before the
    // failure notice appears — allow generous time for that.
    await expect(page.getByText(/preference may not have been saved/i)).toBeVisible({
      timeout: 15_000,
    });

    // The app remains fully usable — the toggle can still be operated.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});

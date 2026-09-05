import { expect, type Page, test } from '@playwright/test';

import { assertUiComponentContrast } from '../helpers/contrast';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import {
  collectMotionFrames,
  expectGradualMotion,
  expectJumpNotGlide,
  startMotionRecorder,
} from '../helpers/motion';
import { getActiveTheme } from '../helpers/theme';

async function goToPreferences(page: Page) {
  await page.goto('/');
  await signInAsFakeGoogleUser(page);
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
  return page
    .getByRole('region', { name: 'Preferences' })
    .getByRole('switch', { name: /dark mode/i });
}

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

test.describe('ThemeToggle knob motion (spec 059 US2)', () => {
  // The knob is the `m.span` (the switch's last child, `z-10`) that wraps the
  // sun/moon artwork; it rides `spring.default` between the ends of the track.
  // Tracked by the persistent wrapper, not the artwork svg, which React swaps
  // out on toggle.
  const KNOB = '[role="switch"][aria-label="Dark mode"] span.z-10';

  test('the knob glides between light and dark rather than snapping', async ({ page }) => {
    const toggle = await goToPreferences(page);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await startMotionRecorder(page, { knob: KNOB }, 900);
    await toggle.click();
    const frames = await collectMotionFrames(page);

    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    // The knob's transform interpolated across several frames (spring), it
    // did not jump straight to the dark-end position.
    expectGradualMotion(frames.knob, 'ThemeToggle knob (light → dark)');
  });

  test('under prefers-reduced-motion the knob jumps with no glide and no residual transform animation', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const toggle = await goToPreferences(page);

    await startMotionRecorder(page, { knob: KNOB }, 700);
    await toggle.click();
    const frames = await collectMotionFrames(page);

    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    // MotionConfig reducedMotion="user" neutralises the knob translate — it
    // snaps to the dark-end position in a single step rather than gliding.
    expectJumpNotGlide(frames.knob, 'ThemeToggle knob under reduced motion');
  });
});

test.describe('ThemeToggle UI component contrast (spec 058, US2)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`meets WCAG UI component contrast against its row surface in ${theme} mode`, async ({
      page,
    }) => {
      // A brand-new user has no saved preference, so the app falls back to
      // the OS-level colorScheme (see the "falls back to the OS setting"
      // test above) — this is what lets emulateMedia drive the rendered
      // theme here without first clicking the toggle.
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/');
      await signInAsFakeGoogleUser(page, {
        displayName: 'Contrast Check User',
        email: `e2e-theme-contrast-${theme}@example.com`,
      });

      await page.getByRole('link', { name: 'Profile' }).click();
      const toggle = page
        .getByRole('region', { name: 'Preferences' })
        .getByRole('switch', { name: /dark mode/i });
      await expect(toggle).toBeVisible();

      // The toggle's actual adjacent surface is the "Dark mode" row it sits
      // in (bg-stone-50/dark:bg-stone-950 in ProfilePage.tsx), not the
      // outer <section> (which carries no background of its own).
      const row = toggle.locator('xpath=..');

      await assertUiComponentContrast(page, toggle, row, `ThemeToggle border (${theme})`);
    });
  }
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

test.describe('Sign-in journey (US1)', () => {
  test('takes the visitor from the landing CTA to the authenticated Dashboard', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-viewport')).toBeVisible();

    await signInAsFakeGoogleUser(page, {
      displayName: 'E2E Test User',
      email: 'e2e-sign-in@example.com',
    });

    // Reaching /app with the Dashboard rendered — which AuthenticatedLayout
    // only renders once a real session has been established via the
    // backend-mediated POST /api/auth/google/complete exchange, driven by
    // LoginCallbackPage after the redirect chain returns from the Google
    // stub — is the authenticated-state signal here.
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('returns to the landing page with no session when the user denies access on the Google stub (FR-014)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-viewport')).toBeVisible();

    await page.getByRole('button', { name: /sign in with google/i }).click();
    await page.waitForSelector('#deny');
    await page.locator('#deny').click();

    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('landing-viewport')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/cancelled/i);
  });

  test('keeps the sign-in header visible after scrolling past the pillar sections (US2)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-viewport')).toBeVisible();

    await page.mouse.wheel(0, 10_000);

    await expect(page.getByRole('banner')).toBeInViewport();
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeInViewport();

    await signInAsFakeGoogleUser(page, {
      displayName: 'E2E Scroll Test User',
      email: 'e2e-scroll-sign-in@example.com',
    });

    await expect(page).toHaveURL(/\/app$/);
  });

  test('has no automatically detectable WCAG 2.1 AA violations (FR-010/SC-006)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-viewport')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

    const seriousOrCritical = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
  });

  for (const [label, viewport] of [
    ['mobile', { width: 375, height: 812 }],
    ['tablet', { width: 768, height: 1024 }],
    ['desktop', { width: 1280, height: 800 }],
  ] as const) {
    test(`renders the sticky header, sign-in action, and pillar sections without layout breakage at ${label} width (FR-005/SC-005)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');

      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const pillarHeadings = page.getByRole('heading', { level: 2 });
      await expect(pillarHeadings).toHaveCount(3);
      for (const heading of await pillarHeadings.all()) {
        await expect(heading).toBeVisible();
      }
    });
  }
});

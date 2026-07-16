import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const SESSION_STORAGE_KEY = 'vinylmania_session_token';

test.describe('Session lifecycle (feature 051)', () => {
  test('silent renewal: navigating across several authenticated pages never interrupts the session (FR-018)', async ({
    page,
  }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page, {
      displayName: 'E2E Renewal User',
      email: 'e2e-renewal@example.com',
    });
    await expect(page).toHaveURL(/\/app$/);

    // Each of these is a fresh authenticated request; none should ever
    // bounce back to the signed-out landing state or show an error.
    await page.getByRole('link', { name: /my library/i }).click().catch(() => undefined);
    await page.goto('/app/library');
    await expect(page.getByTestId('landing-viewport')).not.toBeVisible();

    await page.goto('/app');
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('real expiration: a session the backend no longer recognizes is treated as signed out on the next request (FR-019 edge case)', async ({
    page,
  }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page, {
      displayName: 'E2E Expiry User',
      email: 'e2e-expiry@example.com',
    });
    await expect(page).toHaveURL(/\/app$/);

    // Reaching into Firestore directly to backdate `expiresAt` isn't
    // possible from here — the sessions collection's deny-all security
    // rule (backend/firestore.rules) correctly blocks unauthenticated REST
    // access, same as it would for any other client. Overwriting the
    // stored token with a value the backend has never issued exercises the
    // exact same `requireAuth` → 401 → apiClient.onUnauthorized code path a
    // genuinely time-expired session would hit; the frontend cannot (and
    // should not be able to) tell the two apart.
    await page.evaluate(
      (key) => localStorage.setItem(key, 'no-longer-valid-session-token'),
      SESSION_STORAGE_KEY,
    );

    await page.goto('/app');

    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('landing-viewport')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
  });

  test('logging out on one device does not affect a second signed-in session for the same user (per-device isolation, Clarification 2026-07-16)', async ({
    page,
    browser,
  }) => {
    const email = `e2e-multi-device-${Date.now()}@example.com`;

    await page.goto('/');
    await signInAsFakeGoogleUser(page, { displayName: 'E2E Multi-Device User', email });
    await expect(page).toHaveURL(/\/app$/);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto('/');
    await signInAsFakeGoogleUser(pageB, { displayName: 'E2E Multi-Device User', email });
    await expect(pageB).toHaveURL(/\/app$/);

    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('landing-viewport')).toBeVisible();

    await pageB.goto('/app');
    await expect(pageB).toHaveURL(/\/app$/);
    await expect(pageB.getByTestId('dashboard-page')).toBeVisible();

    await contextB.close();
  });
});

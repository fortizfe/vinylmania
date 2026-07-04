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

    // The Dashboard is a placeholder (feature 007) that doesn't render the
    // signed-in user's name/photo, so the authenticated-state signal here is
    // reaching /app with its header — which AuthenticatedLayout only renders
    // once a real session has been established via POST /api/auth/session.
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });
});

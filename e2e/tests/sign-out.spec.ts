import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

test.describe('Sign-out journey (US1)', () => {
  test('returns to the anonymous landing page and stays out after reload', async ({ page }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page, {
      displayName: 'E2E Sign-out User',
      email: 'e2e-sign-out@example.com',
    });
    await expect(page).toHaveURL(/\/app$/);

    await page.getByRole('button', { name: /sign out/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('landing-viewport')).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('landing-viewport')).toBeVisible();
  });
});

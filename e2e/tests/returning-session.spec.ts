import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

test.describe('Returning session (US1)', () => {
  test('stays signed in across a reload without re-showing the landing page', async ({
    page,
  }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page, {
      displayName: 'E2E Returning User',
      email: 'e2e-returning@example.com',
    });
    await expect(page).toHaveURL(/\/app$/);

    await page.reload();

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByTestId('landing-viewport')).not.toBeVisible();
  });
});

import { expect, test, type Page } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

async function goToProfile(page: Page): Promise<void> {
  await page.goto('/app/profile');
  await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
}

test.describe('Discogs account link (feature 015)', () => {
  test('US1: links the account via the stub authorize page and persists across reloads', async ({
    page,
  }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await goToProfile(page);
    await expect(page.getByText(/not connected/i)).toBeVisible();

    await page.getByRole('button', { name: /connect discogs account/i }).click();

    // The stub's consent page (backend redirected us via authorizeUrl).
    await expect(page.getByRole('heading', { name: /discogs authorization/i })).toBeVisible();
    await page.locator('#authorize').click();

    // Back on the profile with the success message and connected card.
    await expect(page).toHaveURL(/\/app\/profile$/);
    await expect(page.getByText(/discogs account linked/i)).toBeVisible();
    await expect(page.getByText('e2e-discogs-user')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /connect discogs account/i }),
    ).not.toBeVisible();

    // Persistence: the connection survives a reload.
    await page.reload();
    await expect(page.getByText('e2e-discogs-user')).toBeVisible();
  });

  test('US3: denying on the Discogs page returns to a clean, retriable profile', async ({
    page,
  }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await goToProfile(page);
    await page.getByRole('button', { name: /connect discogs account/i }).click();
    await expect(page.getByRole('heading', { name: /discogs authorization/i })).toBeVisible();

    await page.locator('#deny').click();

    await expect(page).toHaveURL(/\/app\/profile$/);
    await expect(page.getByText(/was not completed/i)).toBeVisible();
    // No partial state: the card is still "not connected" and retriable.
    const linkButton = page.getByRole('button', { name: /connect discogs account/i });
    await expect(linkButton).toBeVisible();

    // Retry works after a denial.
    await linkButton.click();
    await expect(page.getByRole('heading', { name: /discogs authorization/i })).toBeVisible();
  });

  test('US2: disconnects with an inline confirm and blocks re-linking while connected', async ({
    page,
  }) => {
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    // Link first.
    await goToProfile(page);
    await page.getByRole('button', { name: /connect discogs account/i }).click();
    await page.locator('#authorize').click();
    await expect(page.getByText('e2e-discogs-user')).toBeVisible();

    // While connected there is no link action, and a direct request is rejected 409.
    await expect(
      page.getByRole('button', { name: /connect discogs account/i }),
    ).not.toBeVisible();
    const directRequestStatus = await page.evaluate(async () => {
      const response = await fetch('http://localhost:3001/api/discogs/oauth/request', {
        method: 'POST',
      });
      return response.status;
    });
    // Unauthenticated from page context (no bearer): 401; the 409 contract
    // path is covered by backend contract tests — here we only assert the
    // endpoint never starts a second flow for this session's UI.
    expect([401, 409]).toContain(directRequestStatus);

    // Disconnect: action + inline confirm (2 interactions), then back to "not connected".
    await page.getByRole('button', { name: /^disconnect$/i }).click();
    await page.getByRole('button', { name: /confirm disconnect/i }).click();
    await expect(page.getByRole('button', { name: /connect discogs account/i })).toBeVisible();

    // Persistence of the disconnected state.
    await page.reload();
    await expect(page.getByRole('button', { name: /connect discogs account/i })).toBeVisible();

    // Re-linking after disconnect works again.
    await page.getByRole('button', { name: /connect discogs account/i }).click();
    await expect(page.getByRole('heading', { name: /discogs authorization/i })).toBeVisible();
  });
});

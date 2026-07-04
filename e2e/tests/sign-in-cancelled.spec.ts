import { expect, test } from '@playwright/test';

test.describe('Cancelled sign-in (edge case)', () => {
  test('shows a friendly retry message instead of a stuck loading state', async ({ page }) => {
    await page.goto('/');

    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: /sign in with google/i }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    await popup.close();

    // Firebase's popup-closed detection polls rather than reacting
    // instantly, so this needs a longer-than-default window.
    await expect(page.getByRole('alert')).toContainText(/cancelled/i, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^sign in with google$/i })).toBeVisible();
    await expect(page.getByTestId('landing-viewport')).toBeVisible();
  });
});

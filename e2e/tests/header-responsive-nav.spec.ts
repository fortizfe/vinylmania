import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

test.describe('Responsive header navigation (US1, US2, US3)', () => {
  test('shows three icon buttons and hides the hamburger at a wide viewport, each navigating correctly (US1)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const profileIcon = page.getByRole('link', { name: /^profile$/i });
    const wishlistIcon = page.getByRole('link', { name: /my wishlist/i });
    const libraryIcon = page.getByRole('link', { name: /my library/i });
    const hamburger = page.getByRole('button', { name: /^menu$/i });

    await expect(profileIcon).toBeVisible();
    await expect(wishlistIcon).toBeVisible();
    await expect(libraryIcon).toBeVisible();
    await expect(hamburger).toBeHidden();

    await libraryIcon.click();
    await expect(page).toHaveURL(/\/app\/library/);
    await expect(page.getByRole('heading', { name: /your library/i })).toBeVisible();

    await wishlistIcon.click();
    await expect(page).toHaveURL(/\/app\/wishlist/);
    await expect(page.getByRole('heading', { name: /my wishlist/i })).toBeVisible();

    await profileIcon.click();
    await expect(page).toHaveURL(/\/app\/profile/);
    await expect(page.getByRole('heading', { name: /^profile$/i })).toBeVisible();
  });

  test('shows the hamburger and hides the icons at a narrow viewport, still navigating correctly (US2)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const hamburger = page.getByRole('button', { name: /^menu$/i });

    await expect(hamburger).toBeVisible();
    await expect(page.getByRole('link', { name: /^profile$/i })).toBeHidden();
    await expect(page.getByRole('link', { name: /my wishlist/i })).toBeHidden();
    await expect(page.getByRole('link', { name: /my library/i })).toBeHidden();

    await hamburger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('link', { name: /my library/i })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /my wishlist/i })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /profile/i })).toBeVisible();

    await dialog.getByRole('link', { name: /my library/i }).click();
    await expect(page).toHaveURL(/\/app\/library/);
    await expect(page.getByRole('heading', { name: /your library/i })).toBeVisible();
  });

  test('switches between the icon layout and the hamburger menu when resized across the breakpoint, with no reload (US3)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const hamburger = page.getByRole('button', { name: /^menu$/i });
    const libraryIcon = page.getByRole('link', { name: /my library/i });

    await expect(libraryIcon).toBeVisible();
    await expect(hamburger).toBeHidden();

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(hamburger).toBeVisible();
    await expect(libraryIcon).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(libraryIcon).toBeVisible();
    await expect(hamburger).toBeHidden();

    // Confirm the switch happened without a page reload/navigation.
    await expect(page).toHaveURL(/\/app$/);
  });
});

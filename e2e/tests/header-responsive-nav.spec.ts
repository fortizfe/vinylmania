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

  test.describe('44x44px touch targets (spec 035, Scenarios 14-15)', () => {
    test('every mobile header control meets 44x44px: hamburger trigger, nav-modal rows, and search submit', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await signInAsFakeGoogleUser(page);

      const hamburger = page.getByRole('button', { name: /^menu$/i });
      const hamburgerBox = await hamburger.boundingBox();
      expect(hamburgerBox?.width).toBeGreaterThanOrEqual(44);
      expect(hamburgerBox?.height).toBeGreaterThanOrEqual(44);

      await hamburger.click();
      const dialog = page.getByRole('dialog');
      for (const name of [/my library/i, /my wishlist/i, /profile/i]) {
        const box = await dialog.getByRole('link', { name }).boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }

      // Sign out lives inside the hamburger menu below `md` (spec 036,
      // Cluster D) — the header-row "Sign out" button is hidden here.
      const signOutRow = dialog.getByRole('button', { name: /sign out/i });
      const signOutBox = await signOutRow.boundingBox();
      expect(signOutBox?.width).toBeGreaterThanOrEqual(44);
      expect(signOutBox?.height).toBeGreaterThanOrEqual(44);
      await expect(
        page.getByRole('button', { name: /sign out/i }).and(page.locator(':visible')),
      ).toHaveCount(1);

      await page.keyboard.press('Escape');

      const searchSubmit = page.getByRole('button', { name: /^search$/i });
      const searchBox = await searchSubmit.boundingBox();
      expect(searchBox?.width).toBeGreaterThanOrEqual(44);
      expect(searchBox?.height).toBeGreaterThanOrEqual(44);
    });

    test('every desktop header control meets 44x44px: nav icons and sign-out button, with no regression to the existing composition', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await signInAsFakeGoogleUser(page);

      for (const name of [/^profile$/i, /my wishlist/i, /my library/i]) {
        const box = await page.getByRole('link', { name }).boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }

      const signOut = page.getByRole('button', { name: /sign out/i });
      const signOutBox = await signOut.boundingBox();
      expect(signOutBox?.width).toBeGreaterThanOrEqual(44);
      expect(signOutBox?.height).toBeGreaterThanOrEqual(44);

      // Desktop composition unchanged: icons visible, hamburger hidden.
      await expect(page.getByRole('button', { name: /^menu$/i })).toBeHidden();
    });
  });

  test.describe('brand mark responsiveness (feature 034)', () => {
    test('shows the icon+wordmark lockup at 1280px, icon-only at 375px and 320px with no overlap of the hamburger, and stays fixed-size at an ultra-wide viewport', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await signInAsFakeGoogleUser(page);

      const brand = page.getByRole('link', { name: 'Vinylmania' });
      await expect(brand).toBeVisible();
      await expect(page.getByText('VINYLMANIA')).toBeVisible();
      const desktopBox = await brand.boundingBox();

      for (const width of [375, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await expect(brand).toBeVisible();
        await expect(page.getByText('VINYLMANIA')).toBeHidden();

        const brandBox = await brand.boundingBox();
        const hamburgerBox = await page.getByRole('button', { name: /^menu$/i }).boundingBox();
        expect(brandBox).not.toBeNull();
        expect(hamburgerBox).not.toBeNull();
        if (brandBox && hamburgerBox) {
          const overlaps =
            brandBox.x < hamburgerBox.x + hamburgerBox.width &&
            brandBox.x + brandBox.width > hamburgerBox.x;
          expect(overlaps, `brand mark and hamburger overlap at ${width}px`).toBe(false);
        }
      }

      // Ultra-wide: the lockup stays at its fixed size rather than scaling up.
      await page.setViewportSize({ width: 2200, height: 900 });
      await expect(page.getByText('VINYLMANIA')).toBeVisible();
      const ultraWideBox = await brand.boundingBox();
      expect(ultraWideBox?.width).toBeCloseTo(desktopBox?.width ?? 0, 0);
      expect(ultraWideBox?.height).toBeCloseTo(desktopBox?.height ?? 0, 0);
    });
  });
});

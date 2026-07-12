import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

// Wishlist is still an "under construction" placeholder (spec 035, FR-009):
// only its container and any present control need to satisfy the dual
// layout / touch-target rules, no real wishlist functionality is added.
test.describe('Wishlist page responsive layout (spec 035, US1, Scenario 7)', () => {
  test('mobile: placeholder container has no horizontal scroll and stays a placeholder', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/wishlist');

    await expect(
      page.getByRole('heading', { name: /my wishlist/i }),
    ).toBeVisible();
    await expect(page.getByText(/under construction/i)).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('desktop: placeholder container renders without regressions and no horizontal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/wishlist');

    await expect(
      page.getByRole('heading', { name: /my wishlist/i }),
    ).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('resizing live across the md/xl breakpoints causes no navigation/reload', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/wishlist');

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('heading', { name: /my wishlist/i })).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByRole('heading', { name: /my wishlist/i })).toBeVisible();

    await expect(page).toHaveURL(/\/app\/wishlist$/);
  });
});

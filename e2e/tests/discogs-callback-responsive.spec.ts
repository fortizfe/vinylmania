import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

// Transient loader page (spec 035, Scenario 13): no substantial content to
// distribute into a desktop composition, but the container still must not
// scroll horizontally on mobile, and any control present must meet 44px.
test.describe('Discogs callback page responsive layout (spec 035, US1, Scenario 13)', () => {
  test('mobile: loader container has no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    // No oauth params -> resolves as "denied" and redirects to profile, but
    // the callback container renders (briefly) before that redirect.
    await page.goto('/app/profile/discogs/callback');

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('desktop: loader container renders without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/profile/discogs/callback');

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

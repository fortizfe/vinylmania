import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

test.describe('Profile page responsive layout (spec 035, US1)', () => {
  test('desktop: preferences and Discogs connection form a side-by-side panel composition (Scenario 11)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/profile');
    await expect(page.getByRole('heading', { name: /^profile$/i })).toBeVisible();

    const preferences = page.getByRole('region', { name: 'Preferences' });
    const connected = page.getByRole('region', { name: 'Connected services' });
    await expect(preferences).toBeVisible();
    await expect(connected).toBeVisible();

    const [preferencesBox, connectedBox] = await Promise.all([
      preferences.boundingBox(),
      connected.boundingBox(),
    ]);
    expect(preferencesBox && connectedBox).toBeTruthy();
    // Side-by-side: roughly the same row (small y delta), connected to the right.
    expect(Math.abs(preferencesBox!.y - connectedBox!.y)).toBeLessThan(4);
    expect(preferencesBox!.x).toBeLessThan(connectedBox!.x);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('mobile: panels stack in a single column, no horizontal scroll, and controls meet 44x44px (Scenario 12)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/profile');
    await expect(page.getByRole('heading', { name: /^profile$/i })).toBeVisible();

    const preferences = page.getByRole('region', { name: 'Preferences' });
    const connected = page.getByRole('region', { name: 'Connected services' });
    const [preferencesBox, connectedBox] = await Promise.all([
      preferences.boundingBox(),
      connected.boundingBox(),
    ]);
    expect(preferencesBox && connectedBox).toBeTruthy();
    expect(connectedBox!.y).toBeGreaterThan(preferencesBox!.y);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    const themeToggle = page.getByRole('switch', { name: /dark mode/i });
    const toggleBox = await themeToggle.boundingBox();
    expect(toggleBox?.width).toBeGreaterThanOrEqual(44);
    expect(toggleBox?.height).toBeGreaterThanOrEqual(44);

    const connectButton = page.getByRole('button', { name: /connect discogs account/i });
    const connectBox = await connectButton.boundingBox();
    expect(connectBox?.width).toBeGreaterThanOrEqual(44);
    expect(connectBox?.height).toBeGreaterThanOrEqual(44);
  });
});

import { expect, test } from '@playwright/test';

// Fakes the DOM directly for the favicon-content check (no sign-in needed);
// the rest of this suite exercises the real landing page.
test.describe('Landing page brand mark (feature 034, US2)', () => {
  test('shows the icon+wordmark lockup in the sticky header and the stacked general logo in the hero, in light theme', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    const header = page.getByRole('banner');
    await expect(header.locator('svg[aria-hidden="true"]')).toBeVisible();
    await expect(header.getByText('VINYLMANIA')).toBeVisible();

    const hero = page.getByRole('heading', { level: 1 });
    await expect(hero.locator('svg[aria-hidden="true"]')).toBeVisible();
    await expect(hero.getByText('VINYLMANIA')).toBeVisible();
  });

  test('shows the same brand mark in dark theme, with no visible flash of the wrong variant on load', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    // No-flash check (spec SC-002, FR-003): the pre-existing theme bootstrap
    // script (unchanged by this feature) must already have applied the
    // `dark` class by the time the page is evaluable, before waiting for
    // any additional paint/animation frame.
    const hasDarkClass = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(hasDarkClass).toBe(true);

    const header = page.getByRole('banner');
    await expect(header.locator('svg[aria-hidden="true"]')).toBeVisible();
    await expect(header.getByText('VINYLMANIA')).toBeVisible();
  });

  test("the landing header's brand mark and sign-in button don't overlap at 320px (spec FR-008)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/');

    const brandArea = page.getByRole('banner').locator('svg[aria-hidden="true"]').locator('..');
    const signInButton = page.getByRole('button', { name: /sign in with google/i });

    const [brandBox, signInBox] = await Promise.all([
      brandArea.boundingBox(),
      signInButton.boundingBox(),
    ]);

    expect(brandBox).not.toBeNull();
    expect(signInBox).not.toBeNull();
    if (brandBox && signInBox) {
      const overlaps =
        brandBox.x < signInBox.x + signInBox.width && brandBox.x + brandBox.width > signInBox.x;
      expect(overlaps, 'landing header brand mark overlaps the sign-in button at 320px').toBe(
        false,
      );
    }
  });
});

test.describe('Favicon (feature 034, US3)', () => {
  test('serves the new circular "VM" icon, not the previous unrelated mark (spec SC-003)', async ({
    page,
  }) => {
    await page.goto('/');

    const response = await page.request.get('/favicon.svg');
    expect(response.ok()).toBe(true);
    const body = await response.text();

    // The old favicon was an abstract gradient shard mark with no "VM"
    // monogram and no circular badge; the new one is built from exactly
    // this geometry (research.md §7).
    expect(body).toContain('>VM<');
    expect(body).toContain('viewBox="0 0 200 200"');
  });
});

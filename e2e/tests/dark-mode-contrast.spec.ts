import { expect, test, type Locator, type Page } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import { getContrastRatio, relativeLuminance, type Rgb } from '../helpers/contrast';

const WCAG_AA_NORMAL_TEXT_RATIO = 4.5;

// The current (pre-darkening) `dark:bg-gray-900` card surface has a relative
// luminance of ~0.0105; the target `dark:bg-gray-950` surface is ~0.0022.
// This threshold sits strictly between the two, so it fails against today's
// gray-900 cards and only passes once they're darkened to gray-950 (research.md R5).
const MAX_CARD_SURFACE_LUMINANCE = 0.005;

/**
 * Normalizes any CSS color string (rgb/rgba/oklch/etc — Tailwind v4 colors
 * compute in oklch) to an [r,g,b] triple by painting it onto a 1x1 canvas
 * and reading the pixel back — canvas always resolves to concrete sRGB
 * byte values regardless of the color space the color was declared in,
 * which is far more robust than parsing the string `ctx.fillStyle` returns.
 */
async function toRgb(page: Page, cssColor: string): Promise<Rgb> {
  return page.evaluate((color) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b] as [number, number, number];
  }, cssColor);
}

/**
 * `getComputedStyle(el)[property]` has been observed to transiently return
 * an empty string right after a client-side route change (most likely a
 * StrictMode-driven remount racing this read), which `toRgb`'s canvas
 * conversion silently treats as opaque black — producing a false-negative
 * "1.07:1" contrast failure even though the element is correctly styled
 * and rendered (confirmed via CI screenshot pixel sampling, spec 043 PR
 * #31). Retrying briefly resolves the race without masking a real empty
 * computed style, which would keep failing past this short window.
 */
async function getResolvedComputedStyle(
  locator: Locator,
  property: 'color' | 'backgroundColor',
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const value = await locator.evaluate(
      (el, prop) => getComputedStyle(el)[prop as 'color' | 'backgroundColor'],
      property,
    );
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Computed ${property} never resolved to a non-empty value`);
}

async function assertReadableContrast(page: Page, locator: Locator, label: string) {
  const [textColor, backgroundColor] = await Promise.all([
    getResolvedComputedStyle(locator, 'color'),
    getResolvedComputedStyle(page.getByTestId('app-shell'), 'backgroundColor'),
  ]);

  const [fg, bg] = await Promise.all([toRgb(page, textColor), toRgb(page, backgroundColor)]);
  const ratio = getContrastRatio(fg, bg);

  expect(ratio, `${label}: contrast ratio ${ratio.toFixed(2)}:1 (fg ${textColor} on bg ${backgroundColor})`).toBeGreaterThanOrEqual(
    WCAG_AA_NORMAL_TEXT_RATIO,
  );
}

test.describe('Dark mode contrast (US3)', () => {
  test('primary text meets WCAG 2.1 AA contrast (>=4.5:1) on major screens', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await signInAsFakeGoogleUser(page, {
      displayName: 'Contrast Check User',
      email: 'e2e-dark-contrast@example.com',
    });

    // Dashboard (header brand text — feed content is loading-state dependent
    // and not deterministic in this hermetic emulator environment)
    const brand = page.getByRole('link', { name: 'Vinylmania' });
    await expect(brand).toBeVisible();
    await assertReadableContrast(page, brand, 'Dashboard header brand link');

    // Search results
    await page.goto('/app/search');
    const searchHeading = page.getByRole('heading', { name: 'Search results' });
    await expect(searchHeading).toBeVisible();
    await assertReadableContrast(page, searchHeading, 'Search results heading');

    // Library
    await page.goto('/app/library');
    const libraryHeading = page.getByRole('heading', { level: 1 });
    await expect(libraryHeading).toBeVisible();
    await assertReadableContrast(page, libraryHeading, 'Library heading');

    // Profile
    await page.goto('/app/profile');
    const profileHeading = page.getByRole('heading', { name: 'Profile' });
    await expect(profileHeading).toBeVisible();
    await assertReadableContrast(page, profileHeading, 'Profile heading');
  });

  test('card surfaces are darkened to the gray-950 target, not left at gray-900', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await signInAsFakeGoogleUser(page, {
      displayName: 'Card Darkness User',
      email: 'e2e-dark-card@example.com',
    });

    await page.goto('/app/profile');
    const preferencesCard = page
      .getByRole('region', { name: 'Preferences' })
      .locator('div', { has: page.getByRole('switch', { name: /dark mode/i }) })
      .first();

    const backgroundColor = await preferencesCard.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    const rgb = await toRgb(page, backgroundColor);
    const luminance = relativeLuminance(rgb);

    expect(
      luminance,
      `Preferences card background ${backgroundColor} has luminance ${luminance.toFixed(4)}, expected <= ${MAX_CARD_SURFACE_LUMINANCE} (darkened to gray-950 or equivalent)`,
    ).toBeLessThanOrEqual(MAX_CARD_SURFACE_LUMINANCE);
  });
});

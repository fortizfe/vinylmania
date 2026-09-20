import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import {
  assertOverlayContentContrast,
  assertReadableContrast,
  assertUiComponentContrast,
  relativeLuminance,
  toRgb,
} from '../helpers/contrast';

// The current (pre-darkening) `dark:bg-gray-900` card surface has a relative
// luminance of ~0.0105; the target `dark:bg-gray-950` surface is ~0.0022.
// This threshold sits strictly between the two, so it fails against today's
// gray-900 cards and only passes once they're darkened to gray-950 (research.md R5).
const MAX_CARD_SURFACE_LUMINANCE = 0.005;

test.describe('Dark mode contrast (US3)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`primary text meets WCAG 2.1 AA contrast (>=4.5:1) on major screens (${theme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/');
      await signInAsFakeGoogleUser(page, {
        displayName: 'Contrast Check User',
        email: `e2e-${theme}-contrast@example.com`,
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
  }

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

/**
 * Spec 059 — User Story 3, FR-007 / FR-009 / SC-005 (T066).
 *
 * The overlay material (dim + blur scrim, opaque floating surface) and the
 * contrast of everything drawn on it, checked in both themes:
 *   • the centered Modal's content sits on its opaque `.overlay-surface` and
 *     clears AA regardless of theme;
 *   • the fullscreen gallery's immersive near-opaque scrim + its close
 *     control's boundary clear the UI-component ratio.
 */
test.describe('Overlay material & contrast (spec 059 US3, T066)', () => {
  /**
   * Spec 068 US3 (T044, research D22): the centred `SelectableListFilter`
   * modal was removed from `/app/library` (live filters in a drawer / bottom
   * sheet now). `/app/search` still renders the same collapsible
   * `FiltersControl` and the same centred Genre modal, so this case moves
   * there and the primitive stays covered in both themes.
   */
  function searchResults() {
    return {
      results: [
        {
          discogsId: 501,
          resultType: 'release',
          title: 'Overlay Record',
          artist: 'Overlay Test Artist',
          year: 1999,
        },
      ],
      pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
    };
  }

  for (const theme of ['light', 'dark'] as const) {
    test(`centered Modal content clears WCAG AA on its opaque surface (${theme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.route('**/api/discogs/search*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(searchResults()),
        });
      });
      await page.goto('/');
      await signInAsFakeGoogleUser(page, { email: `e2e-${theme}-overlay@example.com` });
      await page.goto('/app/search?q=overlay');
      await expect(page.getByText('Overlay Record')).toBeVisible();

      await page.getByRole('button', { name: /^filters$/i }).click();
      await page.locator('#filter-genre-trigger').click();

      const surface = page.locator('[data-testid="modal-backdrop"] .overlay-surface');
      await expect(surface).toBeVisible();
      await assertOverlayContentContrast(page, surface, `Genre Modal surface (${theme})`);
    });

    test(`fullscreen gallery scrim is a near-opaque dim and the close control clears UI contrast (${theme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.route('**/api/discogs/releases/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            discogsId: 1,
            title: 'Stockholm',
            artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
            labels: [],
            formats: [],
            genres: [],
            styles: [],
            tracklist: [],
            images: [
              { url: 'https://example.com/a.jpg', imageType: 'primary' },
              { url: 'https://example.com/b.jpg', imageType: 'secondary' },
            ],
            discogsUrl: 'https://www.discogs.com/release/1',
          }),
        });
      });
      await page.goto('/');
      await signInAsFakeGoogleUser(page, { email: `e2e-${theme}-gallery@example.com` });
      await page.goto('/app/releases/1');
      await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
      await page.getByRole('button', { name: /view stockholm fullscreen/i }).click();

      const scrim = page.getByTestId('gallery-fullscreen-viewer');
      await expect(scrim).toBeVisible();

      const bg = await scrim.evaluate((el) => getComputedStyle(el).backgroundColor);
      const rgb = await toRgb(page, bg);
      expect(
        relativeLuminance(rgb),
        `gallery scrim ${bg} should read as a near-black immersive dim`,
      ).toBeLessThan(0.06);

      await assertUiComponentContrast(
        page,
        page.getByTestId('gallery-fullscreen-close'),
        scrim,
        `Gallery close control boundary (${theme})`,
      );
    });
  }
});

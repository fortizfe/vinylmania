import { expect, type Page, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import {
  assertOverlayContentContrast,
  assertReadableContrast,
  assertUiComponentContrast,
  getContrastRatio,
  getResolvedComputedStyle,
  relativeLuminance,
  toRgb,
} from '../helpers/contrast';
import { installSuggestFixture, TITLE_SEPARATOR } from '../helpers/suggestFixture';

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

/**
 * Spec 069 — User Story 3 (T034, FR-025 / SC-007).
 *
 * The suggestion panel is the newest floating surface in the app and the one
 * place a `loading` state is drawn as bare shapes with no text of its own.
 * Both of its displayable states are checked here, in dark mode, where this
 * palette is tightest:
 *   • `loading` — the skeleton rows are the only thing the state renders, so
 *     they are its sole carrier of meaning and must be perceivable against
 *     the panel they sit on (WCAG 1.4.11, and FR-025's "never colour alone");
 *   • `suggestions` — the row title, the secondary detail and the kind label,
 *     each against the surface it is actually drawn on.
 *
 * Written before T036, per Constitution Principle I.
 */

const SUGGESTION_PANEL = '#header-search-panel';
const SUGGESTION_ROWS = '#header-search-listbox > li:not([aria-hidden="true"])';
const SUGGESTION_SKELETONS = '#header-search-listbox > li[aria-hidden="true"]';
const SUGGEST_QUERY = 'iron ma';

/** WCAG 2.1 AA floor for normal-size text. */
const AA_TEXT_RATIO = 4.5;

/**
 * Signs in dark, opens the header search and types — leaving the panel in
 * whichever state the installed suggest route produces.
 */
async function typeInHeaderSearch(page: Page, email: string): Promise<void> {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await signInAsFakeGoogleUser(page, { email });
  // At the default 1280 px viewport the field is its own opener (069
  // contracts §2), so one click activates the search.
  await page.locator('input#header-search').click();
  await page.keyboard.type(SUGGEST_QUERY, { delay: 40 });
}

test.describe('Header suggestion panel contrast in dark mode (spec 069 US3, T034)', () => {
  test('the loading skeletons are perceivable against the panel surface', async ({ page }) => {
    await installSuggestFixture(page, 'mixed');
    // Hold the lookup in flight so `loading` cannot resolve underneath the
    // measurements: a later `page.route` wins, and never fulfilling keeps the
    // request pending.
    await page.route('**/api/discogs/suggest*', () => {});
    await typeInHeaderSearch(page, 'e2e-dark-suggest-loading@example.com');

    const panel = page.locator(SUGGESTION_PANEL);
    await expect(page.locator(SUGGESTION_SKELETONS)).toHaveCount(5);

    await assertUiComponentContrast(
      page,
      page.locator(SUGGESTION_SKELETONS).first(),
      panel,
      'Suggestion skeleton row against the panel surface (dark)',
    );
  });

  test('the row title, the secondary detail and the kind label clear their floors', async ({
    page,
  }) => {
    await installSuggestFixture(page, 'mixed');
    await typeInHeaderSearch(page, 'e2e-dark-suggest-rows@example.com');

    const panel = page.locator(SUGGESTION_PANEL);
    await expect(page.locator(SUGGESTION_ROWS)).toHaveCount(5);

    // Every visible string drawn on the panel — the row titles and their
    // secondary details included — against the panel's own opaque surface.
    await assertOverlayContentContrast(page, panel, 'Header suggestion panel (dark, suggestions)');

    // `mixed` is 2 artists then 3 albums (data-model §3), so row 2 is the
    // first album: the only row kind that carries a secondary detail.
    const albumRow = page.locator(SUGGESTION_ROWS).nth(2);
    await expect(albumRow).toContainText(`${SUGGEST_QUERY}${TITLE_SEPARATOR}Record 1`);
    await expect(albumRow).toContainText(`${SUGGEST_QUERY}${TITLE_SEPARATOR}Band 1`);

    // The kind label is a filled badge, so its floor is against its own fill
    // rather than the panel behind it (FR-011/FR-025 — it is text, never
    // colour alone, which only helps if the text itself is readable).
    const kindLabel = albumRow.getByText('Album', { exact: true });
    const [kindColor, kindBackground] = await Promise.all([
      getResolvedComputedStyle(kindLabel, 'color'),
      getResolvedComputedStyle(kindLabel, 'backgroundColor'),
    ]);
    const [kindFg, kindBg] = await Promise.all([
      toRgb(page, kindColor),
      toRgb(page, kindBackground),
    ]);
    const kindRatio = getContrastRatio(kindFg, kindBg);
    expect(
      kindRatio,
      `"Album" kind label ${kindColor} on its badge ${kindBackground} is ${kindRatio.toFixed(2)}:1 (< ${AA_TEXT_RATIO}:1)`,
    ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
  });
});

import { expect, test, type Page } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { assertFocusIndicatorContrast } from '../helpers/contrast';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import { samplePress } from '../helpers/press';

/**
 * Spec 059 — User Story 1 (Instant press feedback, P1).
 *
 * Every interactive control must acknowledge a press within ~100 ms of
 * *pointer-down* (native CSS `:active`, see frontend/src/components/ui/press.ts),
 * visually distinct from hover/focus, suppressed while `disabled`/loading, and
 * — under `prefers-reduced-motion` — reduced to a non-vestibular brightness
 * shift with no scale/translate. Keyboard activation still gives an
 * acknowledgement and the shared `focusRing` stays visible and AA-compliant
 * on both themes.
 *
 * The behavioural assertion is the rendered geometry *while the pointer is
 * held down and before it is released*: `pressable` shrinks the control to
 * ~97% (a whole card to ~99%), `pressableNudge` shifts `BackLink` ~2px toward
 * its chevron without scaling. Reading `boundingBox()` (which reflects the
 * post-transform box) rather than a specific computed property keeps the test
 * independent of whether Tailwind v4 emits `scale:` or `transform:` for a
 * given utility.
 */

const RECORD_ENTRY_ID = 'press-feedback-entry-1';

const RECORD_ENTRY = {
  id: RECORD_ENTRY_ID,
  discogsReleaseId: 1,
  addedAt: '2026-07-04T00:00:00.000Z',
  catalogStatus: 'ok',
  release: {
    discogsId: 1,
    title: 'Stockholm',
    year: 1999,
    country: 'Sweden',
    releaseDate: '1999-05-01',
    artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
    labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
    formats: [{ name: 'Vinyl', descriptions: ['12"'] }],
    genres: ['Electronic'],
    styles: ['Deep House'],
    notes: 'Recorded at Stockholm Sound Studio.',
    identifiers: [{ type: 'Barcode', value: '7 39051 23421 6' }],
    community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
    tracklist: [{ position: 'A', title: 'Ostermalm', duration: '4:45' }],
    images: [],
    discogsUrl: 'https://www.discogs.com/release/1',
  },
  discogs: {
    instanceId: 100,
    folderId: 1,
    rating: 0,
    mediaCondition: 'Good (G)',
    sleeveCondition: null,
    notes: 'Bought at a record fair',
    editable: { mediaCondition: true, sleeveCondition: true, notes: true },
  },
};

function buildDashboardResponse() {
  return {
    categories: [
      {
        category: 'News',
        articles: Array.from({ length: 6 }).map((_, i) => ({
          id: `metal-injection-News-${i}`,
          title: `Metal Injection News Article ${i}`,
          excerpt: 'Example excerpt.',
          publishedAt: `2026-07-0${i + 1}T00:00:00.000Z`,
          link: `https://example.test/mi-news-${i}`,
          sourceId: 'metal-injection',
          sourceName: 'Metal Injection',
          category: 'News',
        })),
      },
      {
        category: 'Reviews',
        articles: [
          {
            id: 'metal-storm-Reviews-0',
            title: 'Metal Storm Reviews Article 0',
            excerpt: 'Example excerpt.',
            publishedAt: '2026-07-01T00:00:00.000Z',
            link: 'https://example.test/ms-reviews-0',
            sourceId: 'metal-storm-reviews',
            sourceName: 'Metal Storm',
            category: 'Reviews',
          },
        ],
      },
    ],
    sourceStatuses: [
      { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok', priority: true },
      { sourceId: 'metal-storm-reviews', sourceName: 'Metal Storm', status: 'ok', priority: false },
    ],
    generatedAt: '2026-07-08T00:00:00.000Z',
  };
}

async function mockDashboard(page: Page) {
  await page.route('**/api/feeds/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildDashboardResponse()),
    });
  });
}

async function mockRecordEntry(page: Page) {
  await page.route(`**/api/library/${RECORD_ENTRY_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(RECORD_ENTRY),
    });
  });
}

test.describe('Pressed-state feedback (spec 059 US1)', () => {
  test('a Button depresses on pointer-down, before release (Scenario 1)', async ({ page }) => {
    await mockDashboard(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await expect(page.getByTestId('feed-article-grid')).toBeVisible();

    const searchButton = page.getByRole('button', { name: 'Search', exact: true });
    const sample = await samplePress(page, searchButton);

    // ~3% scale-down (`active:scale-[0.97]`) while held.
    expect(sample.widthRatio).toBeGreaterThan(0.93);
    expect(sample.widthRatio).toBeLessThan(0.99);
    // plus the brightness nudge.
    expect(sample.filter).toContain('brightness');
  });

  test('a filter chip depresses on pointer-down (Scenario 1)', async ({ page }) => {
    await mockDashboard(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await expect(page.getByTestId('feed-article-grid')).toBeVisible();

    const chip = page
      .getByRole('group', { name: /filter by category/i })
      .getByRole('button', { name: 'News', exact: true });

    const sample = await samplePress(page, chip);
    expect(sample.widthRatio).toBeGreaterThan(0.93);
    expect(sample.widthRatio).toBeLessThan(0.99);
    // The chip's shared focus ring (chips had none before 059) is verified,
    // under real keyboard modality, in the "keyboard activation" test below.
  });

  test('a header nav icon depresses on pointer-down', async ({ page }) => {
    await mockDashboard(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await expect(page.getByTestId('feed-article-grid')).toBeVisible();

    const navIcon = page.getByRole('link', { name: /my library/i });
    const sample = await samplePress(page, navIcon);

    expect(sample.widthRatio).toBeGreaterThan(0.93);
    expect(sample.widthRatio).toBeLessThan(0.99);
    expect(sample.filter).toContain('brightness');
  });

  test('a rating star depresses on pointer-down without firing a rating change', async ({
    page,
  }) => {
    await mockRecordEntry(page);
    let sawRatingPatch = false;
    await page.route(`**/api/library/${RECORD_ENTRY_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        sawRatingPatch = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(RECORD_ENTRY),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RECORD_ENTRY),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${RECORD_ENTRY_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const star = page.getByRole('button', { name: '3 stars' });
    const sample = await samplePress(page, star);

    expect(sample.widthRatio).toBeGreaterThan(0.93);
    expect(sample.widthRatio).toBeLessThan(0.99);
    // Released off the control → acceptance scenario 3: no action fired.
    expect(sawRatingPatch).toBe(false);
  });

  test('an inline-edit trigger depresses on pointer-down without entering edit mode', async ({
    page,
  }) => {
    await mockRecordEntry(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${RECORD_ENTRY_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const trigger = page.getByRole('button', { name: /edit notes/i });
    const sample = await samplePress(page, trigger);

    expect(sample.widthRatio).toBeGreaterThan(0.93);
    expect(sample.widthRatio).toBeLessThan(0.99);
    // Drag-off cancel: still in read mode, editor not mounted.
    await expect(page.getByRole('textbox', { name: 'Notes' })).toHaveCount(0);
  });

  test('BackLink nudges toward its chevron on pointer-down (translate, not scale)', async ({
    page,
  }) => {
    await mockRecordEntry(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${RECORD_ENTRY_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const backLink = page.getByRole('link', { name: /back/i });
    const sample = await samplePress(page, backLink);

    // Nudge, not shrink: width unchanged, left edge moves ~2px left.
    expect(Math.abs(sample.pressedWidth - sample.restingWidth)).toBeLessThan(1.5);
    expect(sample.xShift).toBeLessThan(-1);
    expect(sample.xShift).toBeGreaterThan(-4);
  });

  test('a disabled Button shows no press feedback (Scenario, disabled control)', async ({
    page,
  }) => {
    await page.route('**/api/discogs/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              discogsId: 1000,
              resultType: 'release',
              title: 'Result 0',
              artist: 'Test Artist',
              year: 2000,
            },
          ],
          pagination: { page: 1, pages: 1, items: 1, perPage: 1 },
        }),
      });
    });
    await page.route('**/api/library', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ...RECORD_ENTRY, id: 'newly-added' }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/search?q=rock');
    await expect(page.getByTestId('search-results-grid')).toBeVisible();

    await page.getByRole('button', { name: /add to library/i }).first().click();

    const addedButton = page.getByRole('button', { name: /added to library/i });
    await expect(addedButton).toBeDisabled();

    const sample = await samplePress(page, addedButton);

    // The control is inert: no scale-down and no *visible* brightness change
    // (the `disabled:active:*` guards in press.ts neutralise both — a
    // disabled control shows nothing).
    expect(sample.widthRatio, `widthRatio ${sample.widthRatio}`).toBeGreaterThan(0.995);
    const brightness = sample.filter.match(/brightness\(([\d.]+)\)/)?.[1];
    expect(
      sample.filter === 'none' || brightness === '1',
      `expected an inert filter, got "${sample.filter}"`,
    ).toBe(true);
    expect(sample.scale === 'none' || parseFloat(sample.scale) === 1).toBe(true);
  });

  test('whole-card <Link> uses the lighter card press scale (~99%)', async ({ page }) => {
    await page.route('**/api/discogs/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: Array.from({ length: 3 }, (_, i) => ({
            discogsId: 1000 + i,
            resultType: 'release',
            title: `Result ${i}`,
            artist: 'Test Artist',
            year: 2000 + i,
          })),
          pagination: { page: 1, pages: 1, items: 3, perPage: 3 },
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/search?q=rock');
    await expect(page.getByTestId('search-results-grid')).toBeVisible();

    const cardLink = page
      .getByTestId('search-results-grid')
      .getByRole('link')
      .first();

    const sample = await samplePress(page, cardLink);
    // Lighter than a button: shrinks, but only to ~99%.
    expect(sample.widthRatio).toBeLessThan(0.999);
    expect(sample.widthRatio).toBeGreaterThan(0.975);
  });

  test('under prefers-reduced-motion the press keeps the brightness shift but no scale', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockDashboard(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await expect(page.getByTestId('feed-article-grid')).toBeVisible();

    // A Button.
    const searchButton = page.getByRole('button', { name: 'Search', exact: true });
    const buttonSample = await samplePress(page, searchButton);
    expect(buttonSample.widthRatio).toBeGreaterThan(0.99);
    expect(buttonSample.scale === 'none' || parseFloat(buttonSample.scale) === 1).toBe(true);
    expect(buttonSample.filter).toContain('brightness');

    // A filter chip.
    const chip = page
      .getByRole('group', { name: /filter by category/i })
      .getByRole('button', { name: 'News', exact: true });
    const chipSample = await samplePress(page, chip);
    expect(chipSample.widthRatio).toBeGreaterThan(0.99);
    expect(chipSample.filter).toContain('brightness');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`keyboard activation still acknowledges and the focus ring is visible + AA (${theme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await mockDashboard(page);
      await page.goto('/');
      await signInAsFakeGoogleUser(page);
      await expect(page.getByTestId('feed-article-grid')).toBeVisible();

      // Reach the Search button with the keyboard (Tab out of the search
      // input) so :focus-visible is unambiguously in play.
      await page.getByLabel('Search Discogs').focus();
      await page.keyboard.press('Tab');
      const searchButton = page.getByRole('button', { name: 'Search', exact: true });
      await expect(searchButton).toBeFocused();
      expect(await searchButton.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
      expect(await searchButton.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
      await assertFocusIndicatorContrast(page, searchButton, `Search button focus ring (${theme})`);

      // Keyboard activation of a filter chip still toggles it (equivalent
      // acknowledgement to a pointer press — Scenario 4).
      const newsChip = page
        .getByRole('group', { name: /filter by category/i })
        .getByRole('button', { name: 'News', exact: true });
      // Keyboard modality is already established (the Tab above), so a
      // programmatic focus here still resolves :focus-visible.
      await newsChip.focus();
      await expect(newsChip).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('Enter');
      await expect(newsChip).toHaveAttribute('aria-pressed', 'true');
      expect(await newsChip.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
      // The chip's shared focus ring (new in 059 — chips had no focus
      // affordance before) is a visible box-shadow and AA-compliant.
      expect(await newsChip.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
      await assertFocusIndicatorContrast(page, newsChip, `filter chip focus ring (${theme})`);
    });
  }

  for (const theme of ['light', 'dark'] as const) {
    test(`no new serious/critical axe violations on an authed screen (${theme}) — SC-005`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await mockDashboard(page);
      await page.goto('/');
      await signInAsFakeGoogleUser(page);
      await expect(page.getByTestId('feed-article-grid')).toBeVisible();

      const seriousOrCritical = await runAxeScan(page);
      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});

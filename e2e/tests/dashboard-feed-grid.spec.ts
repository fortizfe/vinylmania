import { expect, Page, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import {
  assertHeaderScrollEdge,
  assertHeaderScrollEdgeInstant,
} from '../helpers/scrollEdge';
import { settleStatusFadeIn } from '../helpers/settleEntrance';
import { assertDisplayHeadingTokens } from '../helpers/typography';

function buildArticle(
  category: string,
  sourceId: string,
  sourceName: string,
  index: number,
  dayOffset: number,
) {
  return {
    id: `${sourceId}-${category}-${index}`,
    title: `${sourceName} ${category} Article ${index}`,
    excerpt: 'Example excerpt.',
    publishedAt: `2026-07-${String(8 - dayOffset).padStart(2, '0')}T00:00:00.000Z`,
    link: `https://example.test/${sourceId}-${category.toLowerCase()}-${index}`,
    sourceId,
    sourceName,
    category,
  };
}

function buildDashboardResponse() {
  // 12 News articles across Metal Injection, MetalSucks, and Louder Sound
  // (feature 033 US1/US3), plus one article each in 4 more categories —
  // comfortably over SC-001's 9-visible-without-scroll bar.
  const newsArticles = [
    ...Array.from({ length: 4 }).map((_, i) =>
      buildArticle('News', 'metal-injection', 'Metal Injection', i, i),
    ),
    ...Array.from({ length: 4 }).map((_, i) =>
      buildArticle('News', 'metalsucks', 'MetalSucks', i, i + 4),
    ),
    ...Array.from({ length: 4 }).map((_, i) =>
      buildArticle('News', 'louder-sound', 'Louder Sound', i, i + 8),
    ),
  ];

  return {
    categories: [
      { category: 'News', articles: newsArticles },
      {
        category: 'Reviews',
        articles: [buildArticle('Reviews', 'metal-storm-reviews', 'Metal Storm', 0, 0)],
      },
    ],
    sourceStatuses: [
      { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok', priority: true },
      { sourceId: 'metalsucks', sourceName: 'MetalSucks', status: 'ok', priority: true },
      { sourceId: 'louder-sound', sourceName: 'Louder Sound', status: 'ok', priority: true },
      {
        sourceId: 'metal-storm-reviews',
        sourceName: 'Metal Storm',
        status: 'ok',
        priority: false,
      },
    ],
    generatedAt: '2026-07-08T00:00:00.000Z',
  };
}

// Clicking a source filter button queries GET /api/feeds/sources/:sourceId
// directly (feature 041's fix so a filtered source shows everything it has
// published, not just what already happened to be in the aggregated
// dashboard payload) — a separate endpoint from /api/feeds/dashboard above,
// so it needs its own mock or the request falls through to the real
// backend/network. Reuses the same buildDashboardResponse() article pool so
// a filtered source shows the identical articles a test already asserted on
// via the aggregated view.
async function mockSourceFeedRoutes(page: Page) {
  const dashboard = buildDashboardResponse();
  const allArticles = dashboard.categories.flatMap((group) => group.articles);

  await page.route('**/api/feeds/sources/*', async (route) => {
    const sourceId = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '');
    const sourceStatus = dashboard.sourceStatuses.find((source) => source.sourceId === sourceId);
    const sourceArticles = allArticles.filter((article) => article.sourceId === sourceId);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sourceId,
        sourceName: sourceStatus?.sourceName ?? sourceId,
        status: sourceStatus?.status ?? 'ok',
        articles: sourceArticles,
        generatedAt: dashboard.generatedAt,
      }),
    });
  });
}

// Fakes the /api/feeds/dashboard boundary at the browser network layer (same
// rationale as caching-navigation.spec.ts): this suite drives the real
// Dashboard page/grid in a real browser without depending on live, external
// RSS feeds.
test.describe('Dashboard responsive grid & new sources (feature 033)', () => {
  test('desktop: shows at least 9 articles at once with no scroll/click, no carousel, no "Dashboard" heading (US1, SC-001)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardResponse()),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeHidden();
    await expect(
      page.getByRole('button', { name: /previous articles/i }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: /next articles/i })).toHaveCount(0);

    const grid = page.getByTestId('feed-article-grid');
    await expect(grid).toBeVisible();
    const cardCount = await grid.locator(':scope > div').count();
    expect(cardCount).toBeGreaterThanOrEqual(9);

    // No horizontal scroll on the page itself.
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('desktop: caps the grid at 5 columns on an ultra-wide viewport (Clarifications, Edge Cases)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2200, height: 900 });
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardResponse()),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const grid = page.getByTestId('feed-article-grid');
    await expect(grid).toBeVisible();

    const columnCount = await grid.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateColumns.split(' ').length;
    });
    expect(columnCount).toBe(5);
  });

  test('mobile: single column, no horizontal scroll down to 320px, and comfortable touch targets (US2, SC-002)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardResponse()),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const grid = page.getByTestId('feed-article-grid');
    await expect(grid).toBeVisible();

    const columnCount = await grid.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateColumns.split(' ').length;
    });
    expect(columnCount).toBe(1);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    const allButton = page.getByRole('button', { name: 'All', exact: true });
    const box = await allButton.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('combines category and source filters, showing an empty state for a zero-match combination (US4, FR-013, FR-015)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardResponse()),
      });
    });
    await mockSourceFeedRoutes(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByRole('button', { name: 'Louder Sound', exact: true }).click();
    await expect(page.getByText('Louder Sound News Article 0')).toBeVisible();
    await expect(page.getByText('Metal Injection News Article 0')).toHaveCount(0);

    await page.getByRole('button', { name: 'Reviews', exact: true }).click();
    await expect(page.getByText(/check back soon/i)).toBeVisible();

    await page.getByRole('button', { name: 'All sources', exact: true }).click();
    await expect(page.getByText('Metal Storm Reviews Article 0')).toBeVisible();
  });

  test('preserves the active filter selection when resizing across the desktop/mobile breakpoint (Edge Cases)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardResponse()),
      });
    });
    await mockSourceFeedRoutes(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByRole('button', { name: 'MetalSucks', exact: true }).click();
    await expect(page.getByText('MetalSucks News Article 0')).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });

    await expect(page.getByText('MetalSucks News Article 0')).toBeVisible();
    await expect(page.getByText('Louder Sound News Article 0')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'MetalSucks', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('category and source filters are operable via keyboard alone (spec FR-017)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardResponse()),
      });
    });
    await mockSourceFeedRoutes(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const louderSoundButton = page.getByRole('button', { name: 'Louder Sound', exact: true });
    await louderSoundButton.focus();
    await page.keyboard.press('Enter');

    await expect(louderSoundButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Louder Sound News Article 0')).toBeVisible();
    await expect(page.getByText('Metal Injection News Article 0')).toHaveCount(0);
  });

  test('renders every RSS card at the same height regardless of source, truncating a long title/excerpt instead of growing the card (carried over from feature 028, US4, FR-007/FR-008)', async ({
    page,
  }) => {
    const shortArticle = buildArticle('News', 'metal-injection', 'Metal Injection', 0, 0);
    const longArticle = {
      ...buildArticle('News', 'metalsucks', 'MetalSucks', 1, 1),
      title:
        'A Very Long Article Title That Would Otherwise Wrap Across Several Lines And Grow The Card Well Beyond Its Neighbors',
      excerpt:
        'A very long excerpt describing the article in far more detail than a short summary would, which would otherwise grow the card height well beyond its neighbors if it were not truncated consistently.',
    };

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          categories: [{ category: 'News', articles: [shortArticle, longArticle] }],
          sourceStatuses: [
            {
              sourceId: 'metal-injection',
              sourceName: 'Metal Injection',
              status: 'ok',
              priority: true,
            },
            { sourceId: 'metalsucks', sourceName: 'MetalSucks', status: 'ok', priority: true },
          ],
          generatedAt: '2026-07-08T00:00:00.000Z',
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await expect(page.getByText(shortArticle.title)).toBeVisible();

    const cards = page.getByTestId('feed-article-grid').locator(':scope > div');
    const heights = await cards.evaluateAll((elements) =>
      elements.map((el) => el.getBoundingClientRect().height),
    );
    expect(heights).toHaveLength(2);
    expect(heights[0]).toBeCloseTo(heights[1], 0);

    const longTitle = page.getByText(longArticle.title, { exact: true });
    const [scrollHeight, clientHeight] = await longTitle.evaluate((el) => [
      el.scrollHeight,
      el.clientHeight,
    ]);
    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });

  test('keeps the rest of the dashboard visible when one source is unavailable (US3, FR-011, SC-006)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          categories: [
            {
              category: 'News',
              articles: [buildArticle('News', 'metal-injection', 'Metal Injection', 0, 0)],
            },
          ],
          sourceStatuses: [
            {
              sourceId: 'metal-injection',
              sourceName: 'Metal Injection',
              status: 'ok',
              priority: true,
            },
            { sourceId: 'metalsucks', sourceName: 'MetalSucks', status: 'unavailable', priority: true },
          ],
          generatedAt: '2026-07-08T00:00:00.000Z',
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await expect(page.getByText('Metal Injection News Article 0')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('MetalSucks');
  });
});

// Spec 059 — User Story 5 (FR-014 / FR-015, SC-007). Consistent interaction &
// typography language on the authenticated dashboard shell: the app header's
// scroll-edge treatment, the display-heading tokens on the placeholder-page
// heading reachable from here, and the opacity-only status-banner entrance.
test.describe('Dashboard consistent interaction & typography (spec 059 US5, T088)', () => {
  async function loadDashboard(page: Page): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardResponse()),
      });
    });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await expect(page.getByTestId('feed-article-grid')).toBeVisible();
  }

  test('the app header shows the scroll-edge shadow only after scroll, with no layout shift (FR-014)', async ({
    page,
  }) => {
    await loadDashboard(page);
    await assertHeaderScrollEdge(page, page.getByRole('banner'), 'AppHeader');
  });

  test('under prefers-reduced-motion the app-header scroll-edge appears instantly', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loadDashboard(page);

    const header = page.getByRole('banner');
    await assertHeaderScrollEdgeInstant(header, 'AppHeader');
    await assertHeaderScrollEdge(page, header, 'AppHeader (reduced motion)');
  });

  test('a page display heading carries the tracking-display / leading-display tokens (FR-015)', async ({
    page,
  }) => {
    await loadDashboard(page);

    // Feature 060 replaced the old wishlist "under construction" placeholder
    // with the real `WishlistPage`, whose `<h1>Your wishlist</h1>` uses the
    // same `--font-display` h1 pattern the dashboard shell shares
    // (`font-display tracking-display leading-display`).
    await page.goto('/app/wishlist');
    const heading = page.getByRole('heading', { level: 1, name: /your wishlist/i });
    await assertDisplayHeadingTokens(heading, 'WishlistPage h1');
  });

  test('the feed-source status banner enters with an opacity-only fade — no transform, reduced-motion instant', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          categories: [
            {
              category: 'News',
              articles: [buildArticle('News', 'metal-injection', 'Metal Injection', 0, 0)],
            },
          ],
          sourceStatuses: [
            { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok', priority: true },
            { sourceId: 'metalsucks', sourceName: 'MetalSucks', status: 'unavailable', priority: true },
          ],
          generatedAt: '2026-07-08T00:00:00.000Z',
        }),
      });
    });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const banner = page.getByRole('status');
    await expect(banner).toContainText('MetalSucks');
    await expect(banner).toHaveClass(/status-fade-in/);

    // The entrance animates opacity only — the element never carries a
    // transform/translate/scale, and the `status-fade-in` keyframes touch
    // only `opacity` (emil-design-eng — status messages don't move).
    const entrance = await banner.evaluate((el) => {
      const s = getComputedStyle(el);
      let keyframeText = '';
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRule[] = [];
        try {
          rules = Array.from(sheet.cssRules);
        } catch {
          continue;
        }
        for (const rule of rules) {
          if (
            rule.constructor.name === 'CSSKeyframesRule' &&
            rule.cssText.includes('vinyl-status-fade-in')
          ) {
            keyframeText = rule.cssText;
          }
        }
      }
      return {
        animationName: s.animationName,
        transform: s.transform,
        translate: s.translate,
        scale: s.scale,
        keyframeText,
      };
    });

    expect(entrance.animationName).toContain('vinyl-status-fade-in');
    expect(entrance.transform).toBe('none');
    expect(['none', '']).toContain(entrance.translate);
    expect(['none', '']).toContain(entrance.scale);
    expect(entrance.keyframeText).toMatch(/opacity/);
    expect(entrance.keyframeText).not.toMatch(/transform|translate|scale/);

    // Reduced motion: the fade collapses to instant via the global guard.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reducedDuration = await banner.evaluate(
      (el) => getComputedStyle(el).animationDuration,
    );
    const maxSeconds = Math.max(
      ...reducedDuration.split(',').map((part) => Number.parseFloat(part) || 0),
    );
    expect(
      maxSeconds,
      `status-fade-in not collapsed under reduced motion (animation-duration ${reducedDuration})`,
    ).toBeLessThanOrEqual(0.005);
  });
});

test.describe('Dashboard WCAG 2.1 AA automated scan (spec 058, US1)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no automatically detectable WCAG 2.1 AA violations in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.route('**/api/feeds/dashboard', async (route) => {
        // One source unavailable so the `FeedSourceStatusBanner`
        // (`.status-fade-in`) renders and is covered by this scan.
        const response = buildDashboardResponse();
        response.sourceStatuses = response.sourceStatuses.map((source, index) =>
          index === 0 ? { ...source, status: 'unavailable' } : source,
        );
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      });

      await page.goto('/');
      await signInAsFakeGoogleUser(page);

      const grid = page.getByTestId('feed-article-grid');
      await expect(grid).toBeVisible();
      await expect(page.getByRole('status')).toContainText('unavailable');

      // The banner's 200 ms opacity entrance would otherwise be folded into
      // axe's contrast maths mid-fade (see `settleStatusFadeIn`).
      await settleStatusFadeIn(page);

      const seriousOrCritical = await runAxeScan(page);

      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});

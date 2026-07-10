import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

function buildArticle(category: string, index: number, dayOffset: number) {
  return {
    id: `${category}-${index}`,
    title: `${category} Article ${index}`,
    excerpt: 'Example excerpt.',
    publishedAt: `2026-07-${String(8 - dayOffset).padStart(2, '0')}T00:00:00.000Z`,
    link: `https://example.test/${category.toLowerCase()}-${index}`,
    sourceId: `metal-storm-${category.toLowerCase().replace(' ', '-')}`,
    sourceName: 'Metal Storm',
    category,
  };
}

function buildDashboardResponse() {
  const newsArticles = Array.from({ length: 12 }).map((_, index) => buildArticle('News', index, index));

  return {
    categories: [
      { category: 'News', articles: newsArticles },
      { category: 'Reviews', articles: [buildArticle('Reviews', 0, 0)] },
      { category: 'Interviews', articles: [buildArticle('Interviews', 0, 0)] },
      { category: 'Articles', articles: [buildArticle('Articles', 0, 0)] },
      { category: 'Staff Picks', articles: [buildArticle('Staff Picks', 0, 0)] },
    ],
    sourceStatuses: [
      { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
      { sourceId: 'metal-storm-news', sourceName: 'Metal Storm', status: 'ok' },
    ],
    generatedAt: '2026-07-08T00:00:00.000Z',
  };
}

// Fakes the /api/feeds/dashboard boundary at the browser network layer (same
// rationale as caching-navigation.spec.ts): this suite drives the real
// Dashboard page/carousel in a real browser without depending on live,
// external RSS feeds.
test.describe('Dashboard feed carousels & Metal Storm categories (feature 025)', () => {
  test('loads without a "Dashboard" heading, shows the 5 Metal Storm categories, and the carousel arrows navigate and disable at the ends (US1, US2, US3)', async ({
    page,
  }) => {
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardResponse()),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    // US3: no page title.
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeHidden();

    // US2: all five categories are present, each as its own labeled section.
    for (const category of ['News', 'Reviews', 'Interviews', 'Articles', 'Staff Picks']) {
      await expect(page.getByRole('heading', { name: category, exact: true })).toBeVisible();
    }

    // US1: the "News" category carousel (12 articles) navigates and disables at each end.
    const newsSection = page.locator('section', { has: page.getByRole('heading', { name: 'News', exact: true }) });
    const prevButton = newsSection.getByRole('button', { name: /previous articles/i });
    const nextButton = newsSection.getByRole('button', { name: /next articles/i });

    await expect(newsSection.getByText('News Article 0')).toBeVisible();
    await expect(prevButton).toBeDisabled();
    await expect(nextButton).toBeEnabled();

    for (let i = 0; i < 5; i += 1) {
      await nextButton.click();
    }
    await expect(prevButton).toBeEnabled();
  });
});

test.describe('Dashboard RSS card sizing (feature 028, US4)', () => {
  test('renders every RSS card in a carousel at the same height, truncating a long title/excerpt instead of growing the card (FR-007, FR-008, SC-004)', async ({
    page,
  }) => {
    const shortArticle = buildArticle('News', 0, 0);
    const longArticle = {
      ...buildArticle('News', 1, 1),
      title:
        'A Very Long Article Title That Would Otherwise Wrap Across Several Lines And Grow The Card Well Beyond Its Neighbors',
      excerpt:
        'A very long excerpt describing the article in far more detail than a short summary would, which would otherwise grow the card height well beyond its neighbors if it were not truncated consistently.',
    };

    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          categories: [{ category: 'News', articles: [shortArticle, longArticle] }],
          sourceStatuses: [
            { sourceId: 'metal-storm-news', sourceName: 'Metal Storm', status: 'ok' },
          ],
          generatedAt: '2026-07-08T00:00:00.000Z',
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const newsSection = page.locator('section', {
      has: page.getByRole('heading', { name: 'News', exact: true }),
    });
    await expect(newsSection.getByText('News Article 0')).toBeVisible();

    const cards = newsSection.locator('[data-testid="feed-carousel-track"] > div');
    const heights = await cards.evaluateAll((elements) =>
      elements.map((el) => el.getBoundingClientRect().height),
    );
    expect(heights).toHaveLength(2);
    expect(heights[0]).toBeCloseTo(heights[1], 0);

    // The long title's full text is still in the DOM (readable via
    // getByText) but is visually clamped: its scrollHeight (full content)
    // exceeds its clientHeight (clamped visible box), confirming truncation
    // rather than the card growing to fit it.
    const longTitle = newsSection.getByText(longArticle.title, { exact: true });
    const [scrollHeight, clientHeight] = await longTitle.evaluate((el) => [
      el.scrollHeight,
      el.clientHeight,
    ]);
    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });
});

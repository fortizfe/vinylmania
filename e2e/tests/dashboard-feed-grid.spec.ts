import { expect, Page, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import {
  assertHeaderScrollEdge,
  assertHeaderScrollEdgeInstant,
} from '../helpers/scrollEdge';
import { assertDisplayHeadingTokens } from '../helpers/typography';

const HOUR_MS = 60 * 60 * 1000;

// 1×1 PNG served for every fixture image, so no test reaches a real image
// host. Tests that need a specific image outcome (the T010 404) register
// their own, more specific route later, which Playwright matches first.
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.beforeEach(async ({ page }) => {
  await page.route('https://images.example.test/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG }),
  );
});

// Dates are relative to Date.now() so the fixtures stay inside the 7-day
// Portada window no matter when the suite runs (spec 067 D7).
function buildArticle(
  category: string,
  sourceId: string,
  sourceName: string,
  index: number,
  hoursAgo: number,
) {
  const id = `${sourceId}-${category}-${index}`;
  return {
    id,
    title: `${sourceName} ${category} Article ${index}`,
    excerpt: 'Example excerpt.',
    publishedAt: new Date(Date.now() - hoursAgo * HOUR_MS).toISOString(),
    link: `https://example.test/${sourceId}-${category.toLowerCase()}-${index}`,
    imageUrl: `https://images.example.test/067/${id}.png`,
    sourceId,
    sourceName,
    category,
  };
}

// Ten sources: enough for one lead + four one-per-source tiles + a long
// Latest list, and enough chips to overflow a 390 px chip row.
const SOURCES = [
  { sourceId: 'metal-injection', sourceName: 'Metal Injection', priority: true },
  { sourceId: 'metalsucks', sourceName: 'MetalSucks', priority: true },
  { sourceId: 'louder-sound', sourceName: 'Louder Sound', priority: true },
  { sourceId: 'metal-storm-reviews', sourceName: 'Metal Storm', priority: false },
  { sourceId: 'metal-underground', sourceName: 'Metal Underground', priority: false },
  { sourceId: 'heavy-music', sourceName: 'Heavy Music', priority: false },
  { sourceId: 'blabbermouth', sourceName: 'Blabbermouth', priority: false },
  { sourceId: 'kerrang', sourceName: 'Kerrang', priority: false },
  { sourceId: 'decibel', sourceName: 'Decibel Magazine', priority: false },
  { sourceId: 'revolver', sourceName: 'Revolver', priority: false },
];

// Newest overall (0 h ago) → the lead: "Metal Injection News Article 0".
const LEAD_TITLE = 'Metal Injection News Article 0';

function buildDashboardResponse(unavailableSourceId?: string) {
  // 3 articles per source, all within the last 3 days, interleaved so every
  // source has a recent article (spec 067 US2 scenario 1). The backend now
  // returns a single "News" group (D11).
  const articles = SOURCES.flatMap((source, sourceIndex) =>
    [0, 1, 2].map((i) =>
      buildArticle('News', source.sourceId, source.sourceName, i, i * 24 + sourceIndex * 2),
    ),
  );

  return {
    categories: [{ category: 'News', articles }],
    sourceStatuses: SOURCES.map((source) => ({
      ...source,
      status: source.sourceId === unavailableSourceId ? 'unavailable' : 'ok',
    })),
    generatedAt: new Date().toISOString(),
  };
}

// The unavailable chip's accessible name is "<name> … unavailable" (D12), so
// it is matched by prefix rather than exactly.
function unavailableChip(page: Page, sourceName: string) {
  return page.getByRole('button', { name: new RegExp(`^${sourceName}\\b`) });
}

async function routeDashboard(page: Page, body: unknown = buildDashboardResponse()) {
  await page.route('**/api/feeds/dashboard', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

// Clicking a source filter button queries GET /api/feeds/sources/:sourceId
// directly (feature 041) — a separate endpoint from /api/feeds/dashboard, so
// it needs its own mock or the request falls through to the real backend.
// Reuses the same buildDashboardResponse() article pool.
async function mockSourceFeedRoutes(page: Page) {
  const dashboard = buildDashboardResponse();
  const allArticles = dashboard.categories.flatMap((group) => group.articles);

  await page.route('**/api/feeds/sources/*', async (route) => {
    const sourceId = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '');
    const sourceStatus = dashboard.sourceStatuses.find((source) => source.sourceId === sourceId);
    const sourceArticles = allArticles.filter((article) => article.sourceId === sourceId);
    // Four more, 4–10 days old, so a single source fills the whole Portada
    // (lead, tiles, Latest) and one article is past the all-sources 7-day
    // window (spec 067 US3 scenario 1).
    const sourceName = sourceStatus?.sourceName ?? sourceId;
    const olderArticles = [3, 4, 5, 6].map((i) =>
      buildArticle('News', sourceId, sourceName, i, (i + 1) * 24 + (i === 6 ? 72 : 0)),
    );

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sourceId,
        sourceName,
        status: sourceStatus?.status ?? 'ok',
        articles: [...sourceArticles, ...olderArticles],
        generatedAt: dashboard.generatedAt,
      }),
    });
  });
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
}

interface PortadaGeometry {
  viewportHeight: number;
  lead: Box & { title: string };
  tiles: Box[];
  latestHeadingTop: number;
  rows: Box[];
  /** Every article title (h3) box in document order: lead, tiles, rows. */
  titles: Box[];
}

// Reads the Portada purely from the heading outline in plan.md ("UI
// decisions"): h2 "Top stories" → lead h3 + 4 tile h3s; h2 "Latest" → row
// h3s. Each card's box is the link wrapping the whole card.
async function readPortada(page: Page): Promise<PortadaGeometry> {
  await expect(page.getByRole('heading', { level: 2, name: 'Top stories' })).toBeAttached();
  await expect(page.getByRole('heading', { level: 2, name: 'Latest' })).toBeVisible();

  return page.evaluate(() => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width };
    };
    const cardBox = (title: Element) => box(title.closest('a') ?? title.closest('li') ?? title);

    const headings = Array.from(document.querySelectorAll('h2, h3'));
    const h2Index = (name: string) =>
      headings.findIndex((h) => h.tagName === 'H2' && h.textContent?.trim() === name);
    const topIndex = h2Index('Top stories');
    const latestIndex = h2Index('Latest');

    const topTitles = headings.slice(topIndex + 1, latestIndex).filter((h) => h.tagName === 'H3');
    const rowTitles = headings.slice(latestIndex + 1).filter((h) => h.tagName === 'H3');
    const [leadTitle, ...tileTitles] = topTitles;

    return {
      viewportHeight: window.innerHeight,
      lead: { ...cardBox(leadTitle), title: leadTitle.textContent?.trim() ?? '' },
      tiles: tileTitles.map(cardBox),
      latestHeadingTop: headings[latestIndex].getBoundingClientRect().top,
      rows: rowTitles.map(cardBox),
      titles: [...topTitles, ...rowTitles].map(box),
    };
  });
}

const distinct = (values: number[]) => new Set(values.map(Math.round)).size;

function expectTwoByTwo(tiles: Box[]) {
  expect(tiles, 'the top block has exactly 4 secondary tiles').toHaveLength(4);
  expect(distinct(tiles.map((t) => t.left)), 'tiles form 2 columns').toBe(2);
  expect(distinct(tiles.map((t) => t.top)), 'tiles form 2 rows').toBe(2);
}

async function pageScrollsHorizontally(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

// Spec 067 US2 (T028): the Portada — lead, 2×2 tiles, "Latest" list.
test.describe('Dashboard Portada layout (spec 067 US2, SC-004)', () => {
  test('phone 390×844: lead + at least 3 more titles on the first screen, lead → 2×2 tiles → one-column Latest, no page horizontal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await routeDashboard(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const portada = await readPortada(page);
    const inViewport = (b: Box) => b.top >= 0 && b.bottom <= portada.viewportHeight;

    expect(portada.lead.title, 'the newest article is the lead').toContain(LEAD_TITLE);
    const [leadTitleBox, ...otherTitles] = portada.titles;
    expect(inViewport(leadTitleBox), 'lead headline is on the first screen').toBe(true);
    expect(
      otherTitles.filter(inViewport).length,
      'at least 3 more article titles are on the first screen',
    ).toBeGreaterThanOrEqual(3);

    // Lead full width, then the 2×2 tiles below it, then Latest below them.
    expectTwoByTwo(portada.tiles);
    const tilesLeft = Math.min(...portada.tiles.map((t) => t.left));
    const tilesRight = Math.max(...portada.tiles.map((t) => t.right));
    expect(portada.lead.left).toBeCloseTo(tilesLeft, 0);
    expect(portada.lead.right).toBeCloseTo(tilesRight, 0);
    for (const tile of portada.tiles) {
      expect(tile.top, 'tiles sit below the lead on phones').toBeGreaterThanOrEqual(
        portada.lead.bottom - 1,
      );
    }
    expect(portada.latestHeadingTop).toBeGreaterThanOrEqual(
      Math.max(...portada.tiles.map((t) => t.bottom)) - 1,
    );
    expect(portada.rows.length).toBeGreaterThan(0);
    expect(distinct(portada.rows.map((r) => r.left)), 'Latest is one column on phones').toBe(1);

    expect(await pageScrollsHorizontally(page)).toBe(false);
  });

  test('phone 390×844: the source chip bar is one row that scrolls inside itself, on an opaque sticky bar, with 44 px chips', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await routeDashboard(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await expect(page.getByText(LEAD_TITLE)).toBeVisible();

    const chipBar = page.getByRole('group', { name: 'Filter by source' });
    const bar = await chipBar.evaluate((el) => {
      const chips = Array.from(el.querySelectorAll('button'));
      const before = el.scrollLeft;
      el.scrollLeft = el.scrollWidth;
      const scrolledBy = el.scrollLeft - before;
      const last = chips[chips.length - 1].getBoundingClientRect();
      el.scrollLeft = before;

      let sticky: Element | null = el;
      while (sticky && getComputedStyle(sticky).position !== 'sticky') {
        sticky = sticky.parentElement;
      }

      return {
        height: el.getBoundingClientRect().height,
        chipHeight: Math.max(...chips.map((c) => c.getBoundingClientRect().height)),
        chipTops: chips.map((c) => Math.round(c.getBoundingClientRect().top)),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrolledBy,
        lastChipRightAfterScroll: last.right,
        stickyBackground: sticky ? getComputedStyle(sticky).backgroundColor : null,
      };
    });

    expect(new Set(bar.chipTops).size, 'all chips share one row').toBe(1);
    expect(bar.height, 'chip bar is one chip row high').toBeLessThan(bar.chipHeight * 2);
    expect(bar.scrollWidth, 'many sources overflow the row').toBeGreaterThan(bar.clientWidth);
    expect(bar.scrolledBy, 'the chip bar itself scrolls horizontally').toBeGreaterThan(0);
    expect(bar.lastChipRightAfterScroll).toBeLessThanOrEqual(390);
    expect(await pageScrollsHorizontally(page)).toBe(false);

    // Opaque filter bar (plan.md Materials): no translucency.
    expect(bar.stickyBackground, 'the chip bar sits in a sticky wrapper').not.toBeNull();
    expect(bar.stickyBackground).not.toMatch(/rgba\(.*,\s*0(\.\d+)?\)$|transparent/);

    const allBox = await page.getByRole('button', { name: 'All sources', exact: true }).boundingBox();
    expect(allBox?.width).toBeGreaterThanOrEqual(44);
    expect(allBox?.height).toBeGreaterThanOrEqual(44);
  });

  test('desktop 1280×800: lead in 7 of 12 columns beside a 2×2 tile block, Latest in 2 columns below, heading outline intact', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeDashboard(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    // Heading outline (plan.md): h1 News (sr-only) → h2 Top stories (sr-only) → h2 Latest.
    await expect(page.getByRole('heading', { level: 1, name: 'News' })).toBeAttached();
    const portada = await readPortada(page);

    expect(portada.lead.title).toContain(LEAD_TITLE);
    expectTwoByTwo(portada.tiles);
    for (const tile of portada.tiles) {
      expect(tile.left, 'tiles sit to the right of the lead').toBeGreaterThanOrEqual(
        portada.lead.right - 1,
      );
    }
    const tilesTop = Math.min(...portada.tiles.map((t) => t.top));
    const tilesRight = Math.max(...portada.tiles.map((t) => t.right));
    expect(tilesTop, 'tiles start level with the lead').toBeCloseTo(portada.lead.top, 0);
    expect(tilesTop, 'tiles share the lead row').toBeLessThan(portada.lead.bottom);

    // Lead ≈ 7/12 of the top block's width (gap included in the tolerance).
    const leadShare = portada.lead.width / (tilesRight - portada.lead.left);
    expect(leadShare).toBeGreaterThan(0.5);
    expect(leadShare).toBeLessThan(0.65);

    const topBlockBottom = Math.max(portada.lead.bottom, ...portada.tiles.map((t) => t.bottom));
    expect(portada.latestHeadingTop, 'Latest sits below the top block').toBeGreaterThanOrEqual(
      topBlockBottom - 1,
    );
    expect(distinct(portada.rows.map((r) => r.left)), 'Latest is two columns from lg').toBe(2);

    expect(await pageScrollsHorizontally(page)).toBe(false);
  });

  test('a source chip builds the whole Portada from that source only, and "All sources" restores the all-sources lead (spec 067 US3, FR-013)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeDashboard(page);
    await mockSourceFeedRoutes(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const topStories = page.getByRole('region', { name: 'Top stories' });
    const latest = page.getByRole('region', { name: 'Latest' });
    const lead = topStories.getByRole('heading', { level: 3 }).first();
    await expect(lead).toHaveText(LEAD_TITLE);

    const chip = page.getByRole('button', { name: 'Louder Sound', exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');

    // Lead = the source's newest article; tiles and Latest from it alone.
    await expect(lead).toHaveText('Louder Sound News Article 0');
    await expect(latest).toBeVisible();
    const topTitles = await topStories.getByRole('heading', { level: 3 }).allTextContents();
    const latestTitles = await latest.getByRole('heading', { level: 3 }).allTextContents();
    expect(topTitles.length, 'lead + secondary tiles').toBeGreaterThan(1);
    expect(latestTitles.length).toBeGreaterThan(0);
    for (const title of [...topTitles, ...latestTitles]) {
      expect(title.trim(), 'every Portada title belongs to the selected source').toMatch(
        /^Louder Sound /,
      );
    }
    // Past the all-sources 7-day window, still shown for a single source.
    expect(latestTitles.map((t) => t.trim())).toContain('Louder Sound News Article 6');

    await page.getByRole('button', { name: 'All sources', exact: true }).click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(lead).toHaveText(LEAD_TITLE);
  });

  test('preserves the active source selection when resizing across the desktop/mobile breakpoint (Edge Cases)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeDashboard(page);
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

  test('the source filter is operable via keyboard alone', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeDashboard(page);
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

  test('an article whose image 404s shows the source monogram placeholder in the same box, never a broken-image icon (spec 067 FR-007, SC-002)', async ({
    page,
  }) => {
    const brokenImageUrl = 'https://images.example.test/067/broken-cover.jpg';
    const article = {
      ...buildArticle('News', 'metal-underground', 'Metal Underground', 0, 0),
      imageUrl: brokenImageUrl,
    };

    // Hold the image request until the "before" box is measured, then 404 it,
    // so the before/after comparison is deterministic rather than a race.
    let imageRequested!: () => void;
    const imageRequestSeen = new Promise<void>((resolve) => (imageRequested = resolve));
    let releaseImage!: () => void;
    const imageReleased = new Promise<void>((resolve) => (releaseImage = resolve));
    await page.route(brokenImageUrl, async (route) => {
      imageRequested();
      await imageReleased;
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/feeds/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          categories: [{ category: 'News', articles: [article] }],
          sourceStatuses: [
            {
              sourceId: 'metal-underground',
              sourceName: 'Metal Underground',
              status: 'ok',
              priority: true,
            },
          ],
          generatedAt: '2026-07-08T00:00:00.000Z',
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    // Layout-agnostic: the card is the link wrapping the article's title h3
    // (works for the grid and the Portada alike).
    const card = page
      .locator('a')
      .filter({ has: page.getByRole('heading', { level: 3, name: article.title }) });
    await expect(card.getByText(article.title)).toBeVisible();
    // The image/placeholder slot is the first child of the card's link.
    const mediaSlot = card.locator(':scope > :first-child');

    await imageRequestSeen;
    const cardBefore = await card.boundingBox();
    const mediaBefore = await mediaSlot.boundingBox();

    releaseImage();

    const placeholder = card.getByTestId('feed-article-thumbnail-placeholder');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toHaveText('MU');

    // No visible <img> left in a broken state (loaded-but-empty = broken icon).
    const brokenVisibleImages = await card.locator('img').evaluateAll((imgs) =>
      imgs.filter((img) => {
        const el = img as HTMLImageElement;
        const box = el.getBoundingClientRect();
        return el.complete && el.naturalWidth === 0 && box.width > 0 && box.height > 0;
      }).length,
    );
    expect(brokenVisibleImages).toBe(0);

    const cardAfter = await card.boundingBox();
    const mediaAfter = await mediaSlot.boundingBox();
    expect(cardBefore).not.toBeNull();
    expect(mediaBefore).not.toBeNull();
    expect(cardAfter!.width).toBeCloseTo(cardBefore!.width, 0);
    expect(cardAfter!.height).toBeCloseTo(cardBefore!.height, 0);
    expect(mediaAfter!.width).toBeCloseTo(mediaBefore!.width, 0);
    expect(mediaAfter!.height).toBeCloseTo(mediaBefore!.height, 0);
  });

  // Spec 067 US4 (T045, D12, FR-015): an unavailable source is marked on its
  // own chip; there is no banner and the rest of the news still renders.
  test('one source unavailable: its chip says "unavailable", no banner, the rest of the news still renders (spec 067 US4, FR-015)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeDashboard(page, buildDashboardResponse('metalsucks'));

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await expect(page.getByText(LEAD_TITLE)).toBeVisible();
    await expect(unavailableChip(page, 'MetalSucks')).toContainText('unavailable');
    await expect(page.getByRole('button', { name: 'Louder Sound', exact: true })).not.toContainText(
      'unavailable',
    );
    await expect(
      page.getByRole('status').filter({ hasText: /unavailable/i }),
      'no source-status banner',
    ).toHaveCount(0);
  });

  test('clicking the unavailable chip selects it and shows "temporarily unavailable" (spec 067 US4, US3 scenario 3)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeDashboard(page, buildDashboardResponse('metalsucks'));
    await page.route('**/api/feeds/sources/metalsucks', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sourceId: 'metalsucks',
          sourceName: 'MetalSucks',
          status: 'unavailable',
          articles: [],
          generatedAt: new Date().toISOString(),
        }),
      }),
    );

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const chip = unavailableChip(page, 'MetalSucks');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByText(/temporarily unavailable/).and(page.locator(':not([role="status"])')),
    ).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: /unavailable/i }),
      'no banner repeating the message',
    ).toHaveCount(0);
  });

  test('every source unavailable: the page shows only the single "News is temporarily unavailable" message (spec 067 US4)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeDashboard(page, {
      categories: [],
      sourceStatuses: SOURCES.map((source) => ({ ...source, status: 'unavailable' })),
      generatedAt: new Date().toISOString(),
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await expect(
      page.getByText('News is temporarily unavailable. Please try again later.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('group', { name: 'Filter by source' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Latest' })).toHaveCount(0);
    await expect(page.getByText('No news right now — check back soon.')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: /unavailable/i })).toHaveCount(0);
  });
});

// Spec 067 T050 accessibility audit, findings 1, 2, 4 and 5: focus stays
// visible and unobscured on the Portada, including under forced colours.
test.describe('Dashboard focus visibility (spec 067 T050, WCAG 2.4.7 / 2.4.11, FR-016)', () => {
  async function loadPortada(page: Page, width: number) {
    await page.setViewportSize({ width, height: 800 });
    await routeDashboard(page);
    await mockSourceFeedRoutes(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await expect(page.getByText(LEAD_TITLE)).toBeVisible();
  }

  test('forced colours: keyboard focus draws an outline (the box-shadow ring is stripped there)', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await loadPortada(page, 1280);

    await page.getByRole('button', { name: 'All sources', exact: true }).focus();
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style, 'a real outline, not outline: none').not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });

  test('forced colours: chips keep their pill outline and the selected chip is set apart (FR-016)', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await loadPortada(page, 1280);

    const chip = page.getByRole('button', {
      name: 'Louder Sound',
      exact: true,
    });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    // Let the chips' 130 ms press transition (background-color) settle.
    await expect
      .poll(() => chip.evaluate((el) => el.getAnimations().length))
      .toBe(0);

    const styles = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'Highlight';
      document.body.append(probe);
      const highlight = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const chips = Array.from(
        document.querySelectorAll('[role=group][aria-label="Filter by source"] button'),
      );
      const read = (el: Element) => {
        const s = getComputedStyle(el);
        return {
          bg: s.backgroundColor,
          border: `${s.borderTopStyle} ${s.borderTopWidth}`,
        };
      };
      return {
        forced: matchMedia('(forced-colors: active)').matches,
        highlight,
        selected: read(chips.find((c) => c.getAttribute('aria-pressed') === 'true')!),
        unselected: chips
          .filter((c) => c.getAttribute('aria-pressed') === 'false')
          .map(read),
      };
    });

    expect(styles.forced).toBe(true);
    expect(styles.selected.bg, 'the selected chip is filled with Highlight').toBe(
      styles.highlight,
    );
    for (const other of styles.unselected) {
      expect(other.bg, 'no unselected chip shares the Highlight fill').not.toBe(
        styles.highlight,
      );
      expect(other.border, 'every chip keeps a painted pill border').toBe('solid 1px');
    }
  });

  for (const width of [390, 1280]) {
    test(`${width} px: Shift+Tab back up the page keeps each focused card clear of the sticky header and chip bar`, async ({
      page,
    }) => {
      await loadPortada(page, width);

      const header = page.getByRole('banner');
      const chipBar = page.getByRole('group', { name: 'Filter by source' });
      const lastCard = page
        .getByRole('region', { name: 'Latest' })
        .getByRole('link')
        .last();
      await lastCard.focus();
      await expect(lastCard).toBeFocused();

      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Shift+Tab');
        const stop = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const bar = document.querySelector(
            '[role=group][aria-label="Filter by source"]',
          )!.parentElement!;
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 2);
          return {
            name: el.textContent?.trim().slice(0, 40),
            inChips: !!el.closest('[role=group]') || !!el.closest('header'),
            top: r.top,
            barBottom: bar.getBoundingClientRect().bottom,
            topEdgeHitsItself: !!hit && el.contains(hit),
          };
        });
        if (stop.inChips) break;
        expect(
          stop.top,
          `${stop.name}: top edge clears the chip bar`,
        ).toBeGreaterThanOrEqual(stop.barBottom - 1);
        expect(stop.topEdgeHitsItself, `${stop.name}: not covered by sticky chrome`).toBe(
          true,
        );
      }

      // Scrolled: the chip bar sits right below the header, never under it.
      const headerBottom =
        (await header.boundingBox())!.y + (await header.boundingBox())!.height;
      const barTop = await chipBar.evaluate(
        (el) => el.parentElement!.getBoundingClientRect().top,
      );
      expect(barTop).toBeCloseTo(headerBottom, 0);
    });
  }

  for (const width of [320, 390]) {
    test(`${width} px: every chip reached by Tab, focus ring included, is fully inside the chip row (WCAG 2.4.11)`, async ({
      page,
    }) => {
      await loadPortada(page, width);

      await page.getByRole('button', { name: 'All sources', exact: true }).focus();
      const chipCount = await page
        .getByRole('group', { name: 'Filter by source' })
        .getByRole('button')
        .count();

      for (let i = 0; i < chipCount; i++) {
        const clip = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const row = el.closest('[role=group]')!.getBoundingClientRect();
          const c = el.getBoundingClientRect();
          // ring-2 + ring-offset-2 = 4 px outside the chip.
          return {
            name: el.textContent,
            left: c.left - 4 - row.left,
            right: row.right - (c.right + 4),
          };
        });
        expect(
          clip.left,
          `${clip.name}: ring clear of the left edge`,
        ).toBeGreaterThanOrEqual(-0.5);
        expect(
          clip.right,
          `${clip.name}: ring clear of the right edge`,
        ).toBeGreaterThanOrEqual(-0.5);
        if (i < chipCount - 1) await page.keyboard.press('Tab');
      }
    });
  }

  // Finding 3: Chrome's own accessibility tree (not Playwright's accname)
  // dropped the space and named the chip "MetalSucksunavailable".
  test("the unavailable chip's name in Chrome's accessibility tree is \"<name> unavailable\" (WCAG 4.1.2 / 2.5.3)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeDashboard(page, buildDashboardResponse('metalsucks'));
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await expect(unavailableChip(page, 'MetalSucks')).toContainText('unavailable');

    const cdp = await page.context().newCDPSession(page);
    const { result } = await cdp.send('Runtime.evaluate', {
      expression:
        '[...document.querySelectorAll("button")].find((b) => b.textContent.startsWith("MetalSucks"))',
    });
    const { node } = await cdp.send('DOM.describeNode', { objectId: result.objectId });
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', {
      backendNodeId: node.backendNodeId,
      fetchRelatives: false,
    });
    const button = nodes.find((n) => n.role?.value === 'button');
    expect(button?.name?.value).toBe('MetalSucks unavailable');
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
    // Layout-agnostic wait: survives the grid → Portada swap (spec 067).
    await expect(page.getByText(LEAD_TITLE)).toBeVisible();
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

    // Feature 060 removed the "under construction" placeholder this test used
    // to sample. The Profile page carries the same `--font-display` h1 pattern
    // (`font-display tracking-display leading-display`) and — unlike the data-gated
    // library/wishlist pages — renders its `<h1>` in a single unconditional pass,
    // so there is no loading→gate subtree swap to race `getComputedStyle`.
    await page.goto('/app/profile');
    const heading = page.getByRole('heading', { level: 1, name: /^profile$/i });
    await assertDisplayHeadingTokens(heading, 'ProfilePage h1');
  });

  // The spec 059 "status-banner opacity-only fade" test was here. Spec 067
  // D12 deletes the source status banner, the dashboard's only `status-fade-in`
  // element, so there is nothing left to fade. Its replacement follows FR-017
  // (no content-change animation): the unavailable marker appears without any
  // entrance animation.
  test('the unavailable chip marker appears without an entrance animation (spec 067 FR-017, replaces the spec 059 banner fade)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await routeDashboard(page, buildDashboardResponse('metalsucks'));
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    const chip = unavailableChip(page, 'MetalSucks');
    await expect(chip).toContainText('unavailable');
    const animated = await chip.evaluate((el) =>
      [el, ...Array.from(el.querySelectorAll('*'))]
        .map((node) => getComputedStyle(node).animationName)
        .filter((name) => name !== 'none'),
    );
    expect(animated, 'no entrance animation on the chip or its marker').toEqual([]);
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
        // One source unavailable so its muted chip marker (spec 067 D12)
        // is covered by this scan's contrast checks.
        const response = buildDashboardResponse('metal-injection');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      });

      await page.goto('/');
      await signInAsFakeGoogleUser(page);

      await expect(page.getByText(LEAD_TITLE)).toBeVisible();
      await expect(unavailableChip(page, 'Metal Injection')).toContainText('unavailable');

      const seriousOrCritical = await runAxeScan(page);

      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});

import { expect, type Page, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

/**
 * Feature 068 — library sort (US1) and, later, infinite scroll (US2, T025).
 *
 * `/api/library` is mocked with a 205-record in-memory collection that
 * honours `page`/`pageSize`/`sort`/`dir`/`genre` the way the backend does
 * (contracts/library-list-api.md), ordered by `referenceSort`, a test-side
 * copy of data-model.md §3. The UI must show exactly the reference order.
 */

type Sort = 'added' | 'artist' | 'album';
type Dir = 'asc' | 'desc';

interface FixtureRecord {
  id: string;
  addedAt: string;
  primaryArtist?: string;
  title?: string;
  genre: string[];
}

// Accents, case, leading articles, natural numbers, missing and blank keys.
const ARTISTS: (string | undefined)[] = [
  'Motörhead',
  'motorhead',
  'Björk',
  'Bjork',
  'AC/DC',
  'ac/dc',
  'The Clash',
  'A Perfect Circle',
  'An Pierlé',
  'Los Suaves',
  'El Último de la Fila',
  'Die Ärzte',
  'Les Rita Mitsouko',
  'La Polla Records',
  'The',
  '10cc',
  '2Pac',
  'Blur',
  'Øystein Sevåg',
  'Zappa',
  'clash',
  undefined,
  '   ',
];
const ALBUMS: (string | undefined)[] = [
  'The Wall',
  'Ace of Spades',
  'ace of spades',
  'Homogenic',
  'Highway to Hell',
  'London Calling',
  'A Night at the Opera',
  'Álbum Blanco',
  'El Mal Querer',
  'Die Mensch-Maschine',
  'Les Fleurs',
  'Vol. 2',
  'Vol. 10',
  'Écoute',
  'Zen',
  undefined,
  '',
];

// 205 records; addedAt drops one day every 3 records, so ties come in threes.
// Artist/album indices use strides coprime with the pool sizes so every
// combination (and many same-key ties) occurs.
const FIXTURE: FixtureRecord[] = Array.from({ length: 205 }, (_, i) => {
  const day = new Date(Date.UTC(2026, 6, 31) - Math.floor(i / 3) * 86_400_000);
  return {
    id: `rec-${String(i + 1).padStart(3, '0')}`,
    addedAt: day.toISOString(),
    primaryArtist: ARTISTS[(i * 7) % ARTISTS.length],
    title: ALBUMS[(i * 5) % ALBUMS.length],
    genre: i % 3 === 0 ? ['Jazz'] : i % 3 === 1 ? ['Rock'] : ['Rock', 'Pop'],
  };
});

// ---- Reference sorter: data-model.md §3, verbatim ----

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function sortKey(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return trimmed.replace(/^(the|a|an|el|la|los|las|die|les)\s+(?=\S)/i, '');
}

const byIdAsc = (a: FixtureRecord, b: FixtureRecord) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byAddedDesc = (a: FixtureRecord, b: FixtureRecord) =>
  a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0;

/** Present keys compare with `collator`; a missing key sorts after a present one. */
function compareOptionalKey(a: string | undefined, b: string | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return collator.compare(a, b);
}

function normaliseSort(sort: string | null, dir: string | null): { sort: Sort; dir: Dir } {
  const s: Sort = sort === 'artist' || sort === 'album' ? sort : 'added';
  const fallback: Dir = s === 'added' ? 'desc' : 'asc';
  return { sort: s, dir: dir === 'asc' || dir === 'desc' ? dir : fallback };
}

function referenceSort(records: FixtureRecord[], sort: Sort, dir: Dir): FixtureRecord[] {
  const sign = dir === 'asc' ? 1 : -1;
  if (sort === 'added') {
    return [...records].sort(
      (a, b) => sign * (a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0) || byIdAsc(a, b),
    );
  }
  const artist = (r: FixtureRecord) => sortKey(r.primaryArtist);
  const album = (r: FixtureRecord) => sortKey(r.title);
  const [primary, secondary] = sort === 'artist' ? [artist, album] : [album, artist];
  const present = records.filter((r) => primary(r) !== undefined);
  const missing = records.filter((r) => primary(r) === undefined);
  present.sort(
    (a, b) =>
      sign * collator.compare(primary(a)!, primary(b)!) ||
      compareOptionalKey(secondary(a), secondary(b)) ||
      byAddedDesc(a, b) ||
      byIdAsc(a, b),
  );
  missing.sort((a, b) => byAddedDesc(a, b) || byIdAsc(a, b));
  return [...present, ...missing];
}

function expectedIds(opts: { sort: Sort; dir: Dir; genre?: string }): string[] {
  const filtered = opts.genre
    ? FIXTURE.filter((r) => r.genre.some((g) => opts.genre!.split(',').includes(g)))
    : FIXTURE;
  return referenceSort(filtered, opts.sort, opts.dir).map((r) => r.id);
}

function toListItem(r: FixtureRecord) {
  const n = Number(r.id.slice(4));
  return {
    id: r.id,
    discogsReleaseId: n,
    addedAt: r.addedAt,
    genre: r.genre,
    primaryArtist: r.primaryArtist,
    title: r.title,
    catalogStatus: 'ok',
    discogs: null,
    release: {
      discogsId: n,
      title: r.title ?? '',
      artists: r.primaryArtist ? [{ discogsArtistId: n, name: r.primaryArtist }] : [],
      labels: [],
      formats: [],
      genres: r.genre,
      styles: [],
      tracklist: [],
      images: [],
      discogsUrl: `https://www.discogs.com/release/${n}`,
    },
  };
}

interface LibraryMock {
  /** Every `/api/library` list request, in order. */
  requests: URL[];
  /** Page numbers answered with a 500 until removed again (US2 retry scenario). */
  failPages: Set<number>;
}

/** Mocks `/api/library` with the fixture. Returns the recorded requests and the failure switch. */
async function mockLibrary(page: Page): Promise<LibraryMock> {
  const mock: LibraryMock = { requests: [], failPages: new Set() };
  // `GET /api/library/:id` (record detail) is a different path: the list glob
  // below stops at the next `/`, so it needs its own route.
  await page.route('**/api/library/rec-*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop()!;
    const record = FIXTURE.find((r) => r.id === id);
    await route.fulfill({
      status: record ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(record ? toListItem(record) : { error: 'not_found', message: 'nope' }),
    });
  });
  await page.route('**/api/library*', async (route) => {
    const url = new URL(route.request().url());
    mock.requests.push(url);
    const q = url.searchParams;
    const pageNo = Math.max(1, Number(q.get('page') ?? '1') || 1);
    const pageSize = Math.min(50, Math.max(1, Number(q.get('pageSize') ?? '20') || 20));
    if (mock.failPages.has(pageNo)) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal_error', message: 'Boom' }),
      });
      return;
    }
    const { sort, dir } = normaliseSort(q.get('sort'), q.get('dir'));
    const ids = expectedIds({ sort, dir, genre: q.get('genre') ?? undefined });
    const byId = new Map(FIXTURE.map((r) => [r.id, r]));
    const items = ids
      .slice((pageNo - 1) * pageSize, pageNo * pageSize)
      .map((id) => toListItem(byId.get(id)!));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items, page: pageNo, pageSize, totalItems: ids.length }),
    });
  });
  return mock;
}

const RECORD_LINKS =
  '[data-testid="library-record-grid"] a[href^="/app/library/records/"], [data-testid="library-record-list"] a[href^="/app/library/records/"]';

/** Record ids in on-screen order, read from each record's detail link. */
function renderedIds(page: Page): Promise<string[]> {
  return page
    .locator(RECORD_LINKS)
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')!.split('/').pop()!));
}

async function signIn(page: Page) {
  await page.goto('/');
  await signInAsFakeGoogleUser(page);
}

/** contracts/library-ui.md §4: "You've reached the end of your collection — N records". */
const END_MESSAGE = /reached the end of your collection\s*—\s*\d+ records?/;

const endMessage = (page: Page) => page.getByText(END_MESSAGE);

/**
 * Programmatic scroll on purpose: `page.mouse.wheel` would be a user input in
 * the Layout Instability API's sense, and the CLS scenarios must see the
 * shifts, not have them flagged `hadRecentInput`.
 */
function scrollToBottom(page: Page): Promise<void> {
  return page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
}

/** Scrolls repeatedly until `check()` holds — used to walk through batches. */
async function scrollUntil(page: Page, check: () => Promise<boolean>, timeout = 12_000) {
  await expect
    .poll(
      async () => {
        await scrollToBottom(page);
        return check();
      },
      { timeout, intervals: [150] },
    )
    .toBe(true);
}

const itemCount = async (page: Page) => (await renderedIds(page)).length;

const DEFAULT_ORDER = expectedIds({ sort: 'added', dir: 'desc' });

test.describe('Library infinite scroll (feature 068, US2)', () => {
  const SORTS: { sort: Sort; dir: Dir }[] = [
    { sort: 'added', dir: 'desc' },
    { sort: 'added', dir: 'asc' },
    { sort: 'artist', dir: 'asc' },
    { sort: 'artist', dir: 'desc' },
    { sort: 'album', dir: 'asc' },
    { sort: 'album', dir: 'desc' },
  ];

  for (const { sort, dir } of SORTS) {
    test(`global order: scrolling ${sort}/${dir} to the end shows all 205 records exactly once, in the reference order (SC-007)`, async ({
      page,
    }) => {
      await mockLibrary(page);
      await signIn(page);
      await page.goto(`/app/library?sort=${sort}&dir=${dir}`);

      const expected = expectedIds({ sort, dir });
      await expect.poll(() => renderedIds(page)).toEqual(expected.slice(0, 20));

      await scrollUntil(page, () => endMessage(page).isVisible());

      const ids = await renderedIds(page);
      expect(new Set(ids).size).toBe(ids.length); // no duplicates
      expect(ids).toHaveLength(205); // no gaps
      expect(ids).toEqual(expected);
      await expect(endMessage(page)).toContainText('— 205 records');
    });
  }

  test('prefetch: page 2 is requested while the end of the loaded content is still below the fold (SC-008)', async ({
    page,
  }) => {
    const mock = await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => renderedIds(page)).toEqual(DEFAULT_ORDER.slice(0, 20));

    const pagesRequested = () =>
      mock.requests.map((u) => Number(u.searchParams.get('page') ?? '1'));
    expect(pagesRequested()).not.toContain(2);

    // Stop 250 px short of the bottom: inside the 300 px rootMargin, but with
    // the sentinel that follows the loaded content still off-screen. Loading
    // must start here, before the user gets there. Measured on the sentinel
    // itself (scrollTo is synchronous, so the rect below reflects the scroll).
    const sentinelBelowFold = await page.evaluate(() => {
      const doc = document.documentElement;
      window.scrollTo(0, Math.max(0, doc.scrollHeight - window.innerHeight - 250));
      const sentinel = document.querySelector('[data-testid="library-load-sentinel"]');
      if (sentinel === null) return null;
      return sentinel.getBoundingClientRect().top - window.innerHeight;
    });
    expect(sentinelBelowFold).not.toBeNull();
    expect(sentinelBelowFold).toBeGreaterThan(200);

    await expect.poll(pagesRequested, { timeout: 5_000 }).toContain(2);
  });

  test('tall screen: at 1280×2400 batches keep loading until the viewport is filled, with no scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 2400 });
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    // No "first 20 only" precondition: on a 2400px viewport the sentinel is
    // already inside its 300px margin at first paint, so batch 2 may land
    // before any assertion can observe the first batch alone.
    await expect.poll(() => itemCount(page), { timeout: 10_000 }).toBeGreaterThan(20);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    const ids = await renderedIds(page);
    expect(ids).toEqual(DEFAULT_ORDER.slice(0, ids.length));
  });

  test('retry: a 500 on page 3 keeps the loaded records, shows the alert and Retry, and requests nothing more until Retry is pressed', async ({
    page,
  }) => {
    const mock = await mockLibrary(page);
    mock.failPages.add(3);
    await signIn(page);
    await page.goto('/app/library');
    await expect.poll(() => renderedIds(page)).toEqual(DEFAULT_ORDER.slice(0, 20));

    const alert = page.getByRole('alert').filter({ hasText: "Couldn't load more records" });
    await scrollUntil(page, () => alert.isVisible());

    // Batches 1 and 2 stay on screen.
    expect(await renderedIds(page)).toEqual(DEFAULT_ORDER.slice(0, 40));
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    const page3Requests = () =>
      mock.requests.filter((u) => u.searchParams.get('page') === '3').length;
    expect(page3Requests()).toBe(1);
    await scrollToBottom(page);
    await page.waitForTimeout(1_000); // no automatic reload while the error stands
    expect(page3Requests()).toBe(1);

    mock.failPages.delete(3);
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect.poll(() => renderedIds(page)).toEqual(DEFAULT_ORDER.slice(0, 60));
    await expect(alert).toHaveCount(0);
  });

  test('back navigation: opening a record and pressing Back returns to the same sorted, filtered list (SC-009)', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library?sort=artist&dir=desc&genre=Rock');

    const expected = expectedIds({ sort: 'artist', dir: 'desc', genre: 'Rock' });
    await expect.poll(() => renderedIds(page)).toEqual(expected.slice(0, 20));

    await page.locator(RECORD_LINKS).first().click();
    await expect(page).toHaveURL(new RegExp(`/app/library/records/${expected[0]}$`));

    await page.getByRole('link', { name: 'Back' }).first().click();
    await expect(page).toHaveURL(/[?&]sort=artist(&|$)/);
    await expect(page).toHaveURL(/[?&]dir=desc(&|$)/);
    await expect(page).toHaveURL(/[?&]genre=Rock(&|$)/);
    await expect.poll(async () => (await renderedIds(page)).slice(0, 5)).toEqual(
      expected.slice(0, 5),
    );
  });

  for (const mode of ['grid', 'list'] as const) {
    test(`CLS: loading 3 more batches by scrolling shifts nothing already on screen, in ${mode} mode (SC-001)`, async ({
      page,
      browserName,
    }) => {
      // The Layout Instability API is Chromium-only.
      test.skip(browserName !== 'chromium', 'layout-shift entries are not available');

      await mockLibrary(page);
      await signIn(page);
      await page.goto('/app/library');
      await expect.poll(() => renderedIds(page)).toEqual(DEFAULT_ORDER.slice(0, 20));

      if (mode === 'list') {
        await page.getByTestId('view-mode-list').click();
        await expect(page.getByTestId('library-record-list')).toBeVisible();
      }

      // Only shifts from here on count: the first paint and the view-mode
      // switch are not "loading additional batches by scrolling" (SC-001).
      await page.evaluate(() => {
        const store = window as unknown as { __cls: number };
        store.__cls = 0;
        const from = performance.now();
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput && entry.startTime >= from) store.__cls += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });

      await scrollUntil(page, async () => (await itemCount(page)) >= 80);

      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      test.info().annotations.push({ type: `cls-${mode}`, description: String(cls) });
      expect(cls).toBe(0);
    });
  }
});

test.describe('Library sort (feature 068, US1)', () => {
  test('the fixture is sound: 205 unique records and a reference order covering every edge case', () => {
    expect(new Set(FIXTURE.map((r) => r.id)).size).toBe(205);
    const artistAsc = expectedIds({ sort: 'artist', dir: 'asc' });
    const artistDesc = expectedIds({ sort: 'artist', dir: 'desc' });
    // Missing/blank artists stay last in both directions.
    const missing = FIXTURE.filter((r) => !r.primaryArtist?.trim()).map((r) => r.id);
    expect(missing.length).toBeGreaterThan(0);
    expect(new Set(artistAsc.slice(-missing.length))).toEqual(new Set(missing));
    expect(new Set(artistDesc.slice(-missing.length))).toEqual(new Set(missing));
    // First pages differ between sorts, so every scenario below is meaningful.
    expect(artistAsc.slice(0, 20)).not.toEqual(expectedIds({ sort: 'added', dir: 'desc' }).slice(0, 20));
    expect(expectedIds({ sort: 'artist', dir: 'desc', genre: 'Rock' }).length).toBeGreaterThan(20);
  });

  test('deep link: a fresh session on ?sort=artist&dir=desc&genre=Rock shows the reference first 20 and "Artist (Z → A)" (SC-006)', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library?sort=artist&dir=desc&genre=Rock');

    const expected = expectedIds({ sort: 'artist', dir: 'desc', genre: 'Rock' }).slice(0, 20);
    await expect.soft(async () => expect(await renderedIds(page)).toEqual(expected)).toPass({
      timeout: 10_000,
    });
    await expect.soft(page.locator('#library-sort option:checked')).toHaveText('Artist (Z → A)');
  });

  test('select change: choosing "Album (A → Z)" writes sort/dir to the URL and shows the reference first 20', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    await expect
      .poll(() => renderedIds(page))
      .toEqual(expectedIds({ sort: 'added', dir: 'desc' }).slice(0, 20));

    const select = page.locator('#library-sort');
    await expect(select).toBeVisible();
    await select.selectOption({ label: 'Album (A → Z)' });

    await expect(page).toHaveURL(/[?&]sort=album(&|$)/);
    await expect(page).toHaveURL(/[?&]dir=asc(&|$)/);
    await expect
      .poll(() => renderedIds(page))
      .toEqual(expectedIds({ sort: 'album', dir: 'asc' }).slice(0, 20));
  });

  test('reorder paint: the new first record appears < 100 ms after the sorted response ends (SC-002)', async ({
    page,
  }) => {
    await mockLibrary(page);
    await signIn(page);
    await page.goto('/app/library');
    const defaultIds = expectedIds({ sort: 'added', dir: 'desc' });
    await expect.poll(() => renderedIds(page)).toEqual(defaultIds.slice(0, 20));

    const newFirstId = expectedIds({ sort: 'artist', dir: 'asc' })[0];
    expect(newFirstId).not.toBe(defaultIds[0]);

    // Timestamps are on the page's performance.now() clock:
    //  - responseEnd: Resource Timing entry of the `sort=artist` /api/library request
    //    (responseEnd is exposed even cross-origin without Timing-Allow-Origin).
    //  - shownAt: the MutationObserver callback in which the first record link
    //    in the list first points at the new order's first id.
    await page.evaluate(
      ({ selector, id }) => {
        const probe = { responseEnd: null as number | null, shownAt: null as number | null };
        (window as unknown as { __sortPaint: typeof probe }).__sortPaint = probe;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
            if (/\/api\/library\?/.test(entry.name) && /[?&]sort=artist/.test(entry.name)) {
              probe.responseEnd ??= entry.responseEnd;
            }
          }
        }).observe({ type: 'resource' });
        const mo = new MutationObserver(() => {
          if (document.querySelector(selector)?.getAttribute('href')?.endsWith(`/${id}`)) {
            probe.shownAt = performance.now();
            mo.disconnect();
          }
        });
        mo.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['href'],
        });
      },
      { selector: RECORD_LINKS, id: newFirstId },
    );

    const select = page.locator('#library-sort');
    await expect(select).toBeVisible();
    await select.selectOption({ label: 'Artist (A → Z)' });

    const probe = () =>
      page.evaluate(
        () =>
          (window as unknown as { __sortPaint: { responseEnd: number | null; shownAt: number | null } })
            .__sortPaint,
      );
    await expect.poll(async () => {
      const p = await probe();
      return p.responseEnd !== null && p.shownAt !== null;
    }).toBe(true);
    const { responseEnd, shownAt } = await probe();
    const latency = shownAt! - responseEnd!;
    test.info().annotations.push({ type: 'sort-paint-ms', description: latency.toFixed(1) });
    expect(latency).toBeGreaterThanOrEqual(0);
    expect(latency).toBeLessThan(100);
  });
});

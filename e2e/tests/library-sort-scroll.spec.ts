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

/** Mocks `/api/library` with the fixture. Returns the list of request URLs for later assertions. */
async function mockLibrary(page: Page): Promise<URL[]> {
  const requests: URL[] = [];
  await page.route('**/api/library*', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const q = url.searchParams;
    const pageNo = Math.max(1, Number(q.get('page') ?? '1') || 1);
    const pageSize = Math.min(50, Math.max(1, Number(q.get('pageSize') ?? '20') || 20));
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
  return requests;
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

import { expect, type Page } from '@playwright/test';

import { signInAsFakeGoogleUser } from './fakeGoogleSignIn';

/**
 * Feature 068 — the shared `/api/library` fixture used by every Library spec
 * that needs a real, multi-batch collection (`library-sort-scroll.spec.ts`,
 * `library-toolbar.spec.ts`).
 *
 * `/api/library` is mocked with a 205-record in-memory collection that
 * honours `page`/`pageSize`/`sort`/`dir`/`genre` the way the backend does
 * (contracts/library-list-api.md), ordered by `referenceSort`, a test-side
 * copy of data-model.md §3. The UI must show exactly the reference order.
 */

export type Sort = 'added' | 'artist' | 'album';
export type Dir = 'asc' | 'desc';

export interface FixtureRecord {
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
export const FIXTURE: FixtureRecord[] = Array.from({ length: 205 }, (_, i) => {
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

export function referenceSort(records: FixtureRecord[], sort: Sort, dir: Dir): FixtureRecord[] {
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

export function expectedIds(opts: { sort: Sort; dir: Dir; genre?: string }): string[] {
  const filtered = opts.genre
    ? FIXTURE.filter((r) => r.genre.some((g) => opts.genre!.split(',').includes(g)))
    : FIXTURE;
  return referenceSort(filtered, opts.sort, opts.dir).map((r) => r.id);
}

function toListItem(r: FixtureRecord, coverUrl?: string) {
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
      images: coverUrl ? [{ url: coverUrl, imageType: 'primary' as const }] : [],
      discogsUrl: `https://www.discogs.com/release/${n}`,
    },
  };
}

export interface LibraryMock {
  /** Every `/api/library` list request, in order. */
  requests: URL[];
  /** Page numbers answered with a 500 until removed again (US2 retry scenario). */
  failPages: Set<number>;
}

/**
 * Mocks `/api/library` with the fixture. Returns the recorded requests and the
 * failure switch.
 *
 * `coverUrl` gives every record the same cover image (default: none, so the
 * cards keep their placeholder and every other spec's layout is unchanged).
 * The material-contrast cases pass a *solid* colour there: a solid fill blurs
 * and saturates to itself, so the chrome's painted backdrop over it is exactly
 * research D17's worst case (artwork directly under the 90 % layer).
 */
export async function mockLibrary(
  page: Page,
  { coverUrl }: { coverUrl?: string } = {},
): Promise<LibraryMock> {
  const mock: LibraryMock = { requests: [], failPages: new Set() };
  // `GET /api/library/:id` (record detail) is a different path: the list glob
  // below stops at the next `/`, so it needs its own route.
  await page.route('**/api/library/rec-*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop()!;
    const record = FIXTURE.find((r) => r.id === id);
    await route.fulfill({
      status: record ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(
        record ? toListItem(record, coverUrl) : { error: 'not_found', message: 'nope' },
      ),
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
      .map((id) => toListItem(byId.get(id)!, coverUrl));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items, page: pageNo, pageSize, totalItems: ids.length }),
    });
  });
  return mock;
}

export const RECORD_LINKS =
  '[data-testid="library-record-grid"] a[href^="/app/library/records/"], [data-testid="library-record-list"] a[href^="/app/library/records/"]';

/** Record ids in on-screen order, read from each record's detail link. */
export function renderedIds(page: Page): Promise<string[]> {
  return page
    .locator(RECORD_LINKS)
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')!.split('/').pop()!));
}

export async function signIn(page: Page) {
  await page.goto('/');
  await signInAsFakeGoogleUser(page);
}

/** contracts/library-ui.md §4: "You've reached the end of your collection — N records". */
export const END_MESSAGE = /reached the end of your collection\s*—\s*\d+ records?/;

export const endMessage = (page: Page) => page.getByText(END_MESSAGE);

/**
 * Programmatic scroll on purpose: `page.mouse.wheel` would be a user input in
 * the Layout Instability API's sense, and the CLS scenarios must see the
 * shifts, not have them flagged `hadRecentInput`.
 */
export function scrollToBottom(page: Page): Promise<void> {
  return page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
}

/** Scrolls repeatedly until `check()` holds — used to walk through batches. */
export async function scrollUntil(page: Page, check: () => Promise<boolean>, timeout = 12_000) {
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

export const itemCount = async (page: Page) => (await renderedIds(page)).length;

export const DEFAULT_ORDER = expectedIds({ sort: 'added', dir: 'desc' });

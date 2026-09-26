import type { Page } from '@playwright/test';

/**
 * Spec 069 — the shared `GET /api/discogs/suggest` fixture (quickstart §3).
 *
 * One `page.route('**\/api/discogs/suggest*')` per test, switchable at any
 * moment with `use(variant)`, so a single sign-in can walk the panel through
 * several states. Written for T020 (US2) and reused by T033/T034 (US3, the
 * a11y + dark-mode matrix) and T040/T041 (US4, the `empty` and `error`
 * states) — hence the two variants US2 itself never exercises.
 *
 * The response is the wire shape of contracts/suggest-api.md §2 exactly:
 * `{ suggestions: [...] }`, at most 5 items, optional fields omitted rather
 * than `null`, and **no** `pagination`, no `communityRating`, no echo of `q`.
 * Each variant declares its *raw* hits and the fixture shapes them with
 * `allocate`, a test-side copy of data-model.md §3 — so "6 artist hits" is
 * really 6 hits being cut to 5 by the quota rule the endpoint owns, not a
 * pre-trimmed list pretending to be one.
 *
 * **Every title honours `q`**: it is `<q> — Band <n>` / `<q> — Record <n>`.
 * That is what lets the lookup-counting and type-and-delete scenarios tell
 * which query a rendered row belongs to (FR-013, SC-005) — see
 * `queriesShownIn`. The two nouns are deliberately neither "Artist" nor
 * "Album", so asserting the row's *kind label* can never be satisfied by the
 * title text.
 */

export type SuggestVariant =
  /** 3 artists + 6 albums upstream → 2 artists then 3 albums (data-model §3). */
  | 'mixed'
  /** 6 artist hits, no albums → the panel still fills to 5 (SC-011). */
  | 'artists'
  /** 7 album hits, no artists → 5 albums. */
  | 'albums'
  /** `200 { "suggestions": [] }` — the empty state (FR-018, US4). */
  | 'empty'
  /** `502 catalog_unavailable` — the error state (FR-019, SC-009, US4). */
  | 'error'
  /** The `mixed` payload, held back long enough to observe `loading`. */
  | 'delayed';

export interface CatalogSuggestion {
  discogsId: number;
  resultType: 'release' | 'master' | 'artist';
  title: string;
  artist?: string;
  year?: number;
  format?: string;
  thumbnailUrl?: string;
}

export interface SuggestFixture {
  /** Switch the served variant, effective from the next request. */
  use(variant: SuggestVariant): void;
  /** The `q` of every request served, in order. Truncate it to reset. */
  queries: string[];
}

/** How long `delayed` holds a response back — long enough to see `loading`. */
export const SUGGEST_DELAY_MS = 1_200;

/** Separates the echoed query from the row's own name in every title. */
export const TITLE_SEPARATOR = ' — ';

/**
 * The queries the rendered rows belong to, read out of a panel's text. Every
 * fixture title is one whole line, `<q> — Band <n>` or `<q> — Record <n>`;
 * a line that is anything else (a kind label, an empty state, a secondary
 * detail with a year and a format appended) simply is not a title and is
 * skipped. An empty result therefore means "no rows", which is why the
 * scenarios that use it also assert the rows are there.
 */
export function queriesShownIn(panelText: string): string[] {
  return [...panelText.matchAll(/^(.*) — (?:Band|Record) \d+$/gm)].map((match) => match[1].trim());
}

function artistHit(q: string, n: number): CatalogSuggestion {
  return {
    discogsId: 251_500 + n,
    resultType: 'artist',
    title: `${q}${TITLE_SEPARATOR}Band ${n}`,
  };
}

function albumHit(q: string, n: number): CatalogSuggestion {
  return {
    discogsId: 1_198_000 + n,
    // Alternating so the destination table of contracts §6 is exercised in
    // both directions: `master` → /app/masters/:id, `release` → /app/releases/:id.
    resultType: n % 2 === 1 ? 'master' : 'release',
    title: `${q}${TITLE_SEPARATOR}Record ${n}`,
    artist: `${q}${TITLE_SEPARATOR}Band 1`,
    year: 1980 + n,
    format: 'Vinyl',
  };
}

/** Raw upstream hits per variant, in Discogs' own order. */
function rawHits(variant: SuggestVariant, q: string): CatalogSuggestion[] {
  const artists = (count: number) => Array.from({ length: count }, (_, i) => artistHit(q, i + 1));
  const albums = (count: number) => Array.from({ length: count }, (_, i) => albumHit(q, i + 1));
  switch (variant) {
    case 'mixed':
    case 'delayed':
      return [...artists(3), ...albums(6)];
    case 'artists':
      return artists(6);
    case 'albums':
      return albums(7);
    default:
      return [];
  }
}

/**
 * data-model.md §3, test-side: up to 2 artists and up to 3 albums, cross-filled
 * to 5 taking albums first, output as the taken artists then the taken albums.
 */
export function allocate(hits: CatalogSuggestion[]): CatalogSuggestion[] {
  const artists = hits.filter((hit) => hit.resultType === 'artist');
  const albums = hits.filter((hit) => hit.resultType !== 'artist');
  let takenArtists = Math.min(2, artists.length);
  let takenAlbums = Math.min(3, albums.length);
  while (takenArtists + takenAlbums < 5) {
    if (takenAlbums < albums.length) takenAlbums += 1;
    else if (takenArtists < artists.length) takenArtists += 1;
    else break;
  }
  return [...artists.slice(0, takenArtists), ...albums.slice(0, takenAlbums)];
}

export async function installSuggestFixture(
  page: Page,
  initial: SuggestVariant = 'mixed',
): Promise<SuggestFixture> {
  let variant: SuggestVariant = initial;
  const fixture: SuggestFixture = {
    use: (next) => {
      variant = next;
    },
    queries: [],
  };

  await page.route('**/api/discogs/suggest*', async (route) => {
    const served = variant;
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    fixture.queries.push(q);

    if (served === 'delayed') {
      await new Promise((resolve) => setTimeout(resolve, SUGGEST_DELAY_MS));
    }

    if (served === 'error') {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'catalog_unavailable',
          message: 'The catalog service is temporarily unavailable. Please try again.',
        }),
      });
      return;
    }

    // Defensive short-circuit of contracts §1: under 2 non-whitespace
    // characters the endpoint answers `[]` without an upstream call.
    const suggestions = q.trim().length < 2 ? [] : allocate(rawHits(served, q));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ suggestions }),
    });
  });

  return fixture;
}

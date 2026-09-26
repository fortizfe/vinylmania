import { allocateSuggestions } from '../../../../src/domain/discogsCatalog/suggestionQuota';
import type {
  CatalogSearchResult,
  CatalogSuggestion,
} from '../../../../src/domain/discogsCatalog/types';

/**
 * Feature 069, T012 — the "up to 2 artists + up to 3 albums, cross-filled to
 * 5" rule (spec FR-011, SC-011; data-model.md §3; tasks assumption 4:
 * artists first, then albums).
 *
 * `allocateSuggestions` is a pure domain function: one upstream page of
 * mapped hits in, at most five `CatalogSuggestion`s out. No clock, no
 * randomness, no I/O — which is exactly what makes the truth table below
 * assertable without Discogs.
 */

const MAX_SUGGESTIONS = 5;

function artistHit(n: number): CatalogSearchResult {
  return {
    discogsId: 1000 + n,
    resultType: 'artist',
    title: `Artist ${n}`,
    thumbnailUrl: `https://i.discogs.com/artist-${n}.jpg`,
  };
}

function albumHit(n: number): CatalogSearchResult {
  return {
    // Alternating release/master, because "album" is `release | master`
    // (data-model §1) and both must land in the same album bucket.
    discogsId: 2000 + n,
    resultType: n % 2 === 0 ? 'release' : 'master',
    title: `Album ${n}`,
    artist: `Performer ${n}`,
    year: 1980 + n,
    formats: ['Vinyl', 'LP', 'Album'],
    thumbnailUrl: `https://i.discogs.com/album-${n}.jpg`,
  };
}

/**
 * `a` artists and `b` albums, interleaved in one list — so the partition
 * step has real work to do and "Discogs' own order preserved inside each
 * group" is a meaningful assertion rather than a tautology.
 */
function hits(a: number, b: number): CatalogSearchResult[] {
  const list: CatalogSearchResult[] = [];
  for (let i = 0; i < Math.max(a, b); i += 1) {
    if (i < a) {
      list.push(artistHit(i));
    }
    if (i < b) {
      list.push(albumHit(i));
    }
  }
  return list;
}

function artistsOf(suggestions: CatalogSuggestion[]): CatalogSuggestion[] {
  return suggestions.filter((s) => s.resultType === 'artist');
}

function albumsOf(suggestions: CatalogSuggestion[]): CatalogSuggestion[] {
  return suggestions.filter((s) => s.resultType !== 'artist');
}

describe('allocateSuggestions: the 2 + 3 quota with cross-fill (data-model §3)', () => {
  // Every row of data-model.md §3's truth table. Rows written "≥N" in the
  // table are exercised at a concrete availability that makes the stated
  // allocation reachable — e.g. "≥2 artists, 1 album → 4 artists" needs at
  // least 4 artists to exist, and is the contract's "6 artists + 1 album"
  // fixture (contracts/suggest-api.md §7 case 5).
  it.each<[string, number, number, number, number]>([
    ['A≥2, B≥3 → 2 artists + 3 albums', 4, 9, 2, 3],
    ['A=0, B≥5 → 0 artists + 5 albums', 0, 9, 0, 5],
    ['A=1, B≥4 → 1 artist + 4 albums', 1, 9, 1, 4],
    ['A≥2, B=1 → 4 artists + 1 album', 6, 1, 4, 1],
    ['A≥5, B=0 → 5 artists + 0 albums', 9, 0, 5, 0],
    ['A=1, B=1 → 1 artist + 1 album', 1, 1, 1, 1],
    ['A=0, B=0 → nothing', 0, 0, 0, 0],
    ['A≥2, B=2 → 3 artists + 2 albums', 6, 2, 3, 2],
  ])('%s', (_label, availableArtists, availableAlbums, expectedArtists, expectedAlbums) => {
    const result = allocateSuggestions(hits(availableArtists, availableAlbums));

    expect(artistsOf(result)).toHaveLength(expectedArtists);
    expect(albumsOf(result)).toHaveLength(expectedAlbums);
    expect(result).toHaveLength(expectedArtists + expectedAlbums);
  });
});

describe('allocateSuggestions: invariants (FR-011, SC-011)', () => {
  const availabilities = [0, 1, 2, 3, 4, 5, 6, 9];

  it('always returns min(5, artists + albums) suggestions', () => {
    for (const a of availabilities) {
      for (const b of availabilities) {
        const result = allocateSuggestions(hits(a, b));
        expect({ a, b, length: result.length }).toEqual({
          a,
          b,
          length: Math.min(MAX_SUGGESTIONS, a + b),
        });
      }
    }
  });

  it('never returns more than 5 suggestions, however large the input page', () => {
    expect(allocateSuggestions(hits(20, 20))).toHaveLength(MAX_SUGGESTIONS);
  });

  it('only ever returns hits that were present in the input', () => {
    const input = hits(6, 9);
    const inputIds = new Set(input.map((h) => h.discogsId));

    for (const suggestion of allocateSuggestions(input)) {
      expect(inputIds.has(suggestion.discogsId)).toBe(true);
    }
  });

  it('never repeats a hit', () => {
    const result = allocateSuggestions(hits(6, 9));
    const ids = result.map((s) => s.discogsId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts artists before albums and preserves Discogs order inside each group (assumption 4)', () => {
    const result = allocateSuggestions(hits(4, 9));

    expect(result.map((s) => s.resultType)).toEqual([
      'artist',
      'artist',
      'release',
      'master',
      'release',
    ]);
    // Artists 0,1 then albums 0,1,2 — the first of each group in the order
    // Discogs returned them, never re-sorted by the cross-fill.
    expect(result.map((s) => s.discogsId)).toEqual([1000, 1001, 2000, 2001, 2002]);
  });

  it('keeps Discogs order inside each group when the cross-fill runs (A=6, B=1)', () => {
    const result = allocateSuggestions(hits(6, 1));

    // Base 2 artists + 1 album, then the cross-fill takes artists 2 and 3
    // (albums are exhausted) — still emitted in Discogs order, artists first.
    expect(result.map((s) => s.discogsId)).toEqual([1000, 1001, 1002, 1003, 2000]);
  });

  it('is deterministic: the same input always gives the same output', () => {
    const input = hits(4, 9);

    expect(allocateSuggestions(input)).toEqual(allocateSuggestions(input));
  });

  it('does not mutate its input array', () => {
    const input = hits(6, 9);
    const before = JSON.parse(JSON.stringify(input)) as CatalogSearchResult[];

    allocateSuggestions(input);

    expect(input).toEqual(before);
    expect(input).toHaveLength(15);
  });
});

describe('allocateSuggestions: the CatalogSuggestion projection (data-model §2)', () => {
  it('keeps only the panel fields, dropping communityRating, country, labels and the extra formats', () => {
    const [suggestion] = allocateSuggestions([
      {
        discogsId: 1198042,
        resultType: 'master',
        title: 'The Number Of The Beast',
        artist: 'Iron Maiden',
        year: 1982,
        formats: ['Vinyl', 'LP', 'Album'],
        thumbnailUrl: 'https://i.discogs.com/cover.jpg',
        communityRating: { average: 4.5, count: 812 },
        country: 'UK',
        labels: ['EMI'],
      },
    ]);

    expect(suggestion).toEqual({
      discogsId: 1198042,
      resultType: 'master',
      title: 'The Number Of The Beast',
      artist: 'Iron Maiden',
      year: 1982,
      // First format only — the panel has one line for it.
      format: 'Vinyl',
      thumbnailUrl: 'https://i.discogs.com/cover.jpg',
    });
  });

  it('omits absent optional fields rather than emitting null', () => {
    const [suggestion] = allocateSuggestions([
      { discogsId: 251595, resultType: 'artist', title: 'Iron Maiden' },
    ]);

    expect(suggestion).toEqual({
      discogsId: 251595,
      resultType: 'artist',
      title: 'Iron Maiden',
    });
    expect(Object.keys(suggestion)).toEqual(['discogsId', 'resultType', 'title']);
  });

  it('omits format when the hit carries an empty formats array', () => {
    const [suggestion] = allocateSuggestions([
      {
        discogsId: 3,
        resultType: 'release',
        title: 'Untitled',
        formats: [],
      },
    ]);

    expect('format' in suggestion).toBe(false);
  });
});

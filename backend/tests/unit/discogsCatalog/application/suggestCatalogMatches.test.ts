import { createSuggestCatalogMatchesUseCase } from '../../../../src/application/discogsCatalog/suggestCatalogMatches';
import type {
  CatalogCredential,
  CatalogSearchResponse,
  CatalogSearchResult,
} from '../../../../src/domain/discogsCatalog/types';
import type { CachePort } from '../../../../src/ports/cache/cachePort';
import type { DiscogsCatalogPort } from '../../../../src/ports/discogsCatalog/discogsCatalogPort';

/**
 * Feature 069, T013 — the suggestion use case over port doubles (spec
 * FR-010, FR-016, FR-017, SC-011; research D3, D5; tasks assumption 3:
 * `perPage: 20`).
 *
 * The three things this file exists to pin down: exactly one upstream
 * search per cache miss, zero rating fan-out, and a normalised, shared
 * cache key with a 5-minute TTL holding the *shaped* payload.
 */

const CREDENTIAL: CatalogCredential = { type: 'vinylmania' };
const SUGGEST_CACHE_TTL_SECONDS = 300;

interface RecordingCache extends CachePort {
  /** Every `withCache` call, in order — the key and TTL assertions read this. */
  calls: Array<{ key: string; ttlSeconds: number }>;
  /** What was actually cached, so "the shaped payload, not the raw hits" is assertable. */
  store: Map<string, unknown>;
}

/** A `CachePort` double that really caches, so a second lookup can hit it. */
function recordingCache(): RecordingCache {
  const calls: Array<{ key: string; ttlSeconds: number }> = [];
  const store = new Map<string, unknown>();

  return {
    calls,
    store,
    has: jest.fn().mockResolvedValue(false),
    set: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
    async withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
      calls.push({ key, ttlSeconds });
      if (store.has(key)) {
        return store.get(key) as T;
      }
      const value = await fetcher();
      store.set(key, value);
      return value;
    },
  };
}

/**
 * A `CachePort` double standing in for a cache outage: `withCache` honours
 * its port contract (it MUST NOT reject) by going straight to the fetcher
 * and caching nothing — exactly what `cacheAside.ts` does with no Redis.
 */
function outageCache(): RecordingCache {
  const calls: Array<{ key: string; ttlSeconds: number }> = [];

  return {
    calls,
    store: new Map<string, unknown>(),
    has: jest.fn().mockResolvedValue(false),
    set: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
    async withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
      calls.push({ key, ttlSeconds });
      return fetcher();
    },
  };
}

function artistHit(n: number): CatalogSearchResult {
  return { discogsId: 1000 + n, resultType: 'artist', title: `Artist ${n}` };
}

function albumHit(n: number): CatalogSearchResult {
  return {
    discogsId: 2000 + n,
    resultType: n % 2 === 0 ? 'release' : 'master',
    title: `Album ${n}`,
    artist: `Performer ${n}`,
    year: 1980 + n,
    formats: ['Vinyl', 'LP'],
    communityRating: { average: 4.5, count: 10 },
  };
}

/** One upstream page: `a` artists and `b` albums interleaved, as Discogs returns them. */
function upstreamPage(a: number, b: number): CatalogSearchResponse {
  const results: CatalogSearchResult[] = [];
  for (let i = 0; i < Math.max(a, b); i += 1) {
    if (i < a) {
      results.push(artistHit(i));
    }
    if (i < b) {
      results.push(albumHit(i));
    }
  }
  return { results, pagination: { page: 1, pages: 1, items: results.length, perPage: 20 } };
}

/**
 * A `DiscogsCatalogPort` double. `getReleaseRating` / `getMasterRelease`
 * are plain mocks that must never be called on this path (FR-017, SC-011);
 * the remaining methods exist only to satisfy the interface.
 */
function fakeCatalog(response: CatalogSearchResponse = upstreamPage(4, 9)) {
  return {
    getRelease: jest.fn(),
    getArtist: jest.fn(),
    getMasterRelease: jest.fn(),
    getMasterReleaseVersions: jest.fn(),
    getReleaseRating: jest.fn(),
    searchCatalog: jest.fn().mockResolvedValue(response),
  } as unknown as jest.Mocked<DiscogsCatalogPort>;
}

describe('suggestCatalogMatches: upstream cost (SC-011, FR-016, research D3)', () => {
  it('makes exactly one searchCatalog call per cache miss, with resultType any, page 1 and perPage 20', async () => {
    const discogsCatalog = fakeCatalog();
    const { suggestCatalogMatches } = createSuggestCatalogMatchesUseCase({
      discogsCatalog,
      cache: recordingCache(),
    });

    await suggestCatalogMatches(CREDENTIAL, 'Iron Maiden');

    expect(discogsCatalog.searchCatalog).toHaveBeenCalledTimes(1);
    expect(discogsCatalog.searchCatalog).toHaveBeenCalledWith(CREDENTIAL, 'Iron Maiden', {
      resultType: 'any',
      page: 1,
      perPage: 20,
    });
  });

  it('never enriches with ratings: zero getReleaseRating and zero getMasterRelease calls', async () => {
    const discogsCatalog = fakeCatalog(upstreamPage(4, 9));
    const { suggestCatalogMatches } = createSuggestCatalogMatchesUseCase({
      discogsCatalog,
      cache: recordingCache(),
    });

    const suggestions = await suggestCatalogMatches(CREDENTIAL, 'Iron Maiden');

    expect(suggestions).toHaveLength(5);
    expect(discogsCatalog.getReleaseRating).not.toHaveBeenCalled();
    expect(discogsCatalog.getMasterRelease).not.toHaveBeenCalled();
  });

  it('returns the shaped 2 artists + 3 albums allocation, artists first (FR-011, assumption 4)', async () => {
    const { suggestCatalogMatches } = createSuggestCatalogMatchesUseCase({
      discogsCatalog: fakeCatalog(upstreamPage(4, 9)),
      cache: recordingCache(),
    });

    const suggestions = await suggestCatalogMatches(CREDENTIAL, 'Iron Maiden');

    expect(suggestions.map((s) => s.discogsId)).toEqual([1000, 1001, 2000, 2001, 2002]);
    expect(suggestions.every((s) => !('communityRating' in s))).toBe(true);
  });
});

describe('suggestCatalogMatches: cache key, TTL and normalisation (FR-017, research D5)', () => {
  it('caches under discogs:suggest:{normalizedQuery} with a 300 s TTL', async () => {
    const cache = recordingCache();
    const { suggestCatalogMatches } = createSuggestCatalogMatchesUseCase({
      discogsCatalog: fakeCatalog(),
      cache,
    });

    await suggestCatalogMatches(CREDENTIAL, 'Iron Maiden');

    expect(cache.calls).toEqual([
      { key: 'discogs:suggest:iron maiden', ttlSeconds: SUGGEST_CACHE_TTL_SECONDS },
    ]);
  });

  it.each<[string, string, string]>([
    ['trailing whitespace', 'Iron ', 'discogs:suggest:iron'],
    ['already normalised', 'iron', 'discogs:suggest:iron'],
    ['upper case', 'IRON', 'discogs:suggest:iron'],
    ['collapsed internal whitespace', 'iron  maiden', 'discogs:suggest:iron maiden'],
    ['single internal space', 'iron maiden', 'discogs:suggest:iron maiden'],
    ['mixed case and padding', '  Iron   MAIDEN  ', 'discogs:suggest:iron maiden'],
  ])('normalises %s into %p → %p', async (_label, query, expectedKey) => {
    const cache = recordingCache();
    const { suggestCatalogMatches } = createSuggestCatalogMatchesUseCase({
      discogsCatalog: fakeCatalog(),
      cache,
    });

    await suggestCatalogMatches(CREDENTIAL, query);

    expect(cache.calls[0].key).toBe(expectedKey);
  });

  it('serves a second lookup of the same query inside the TTL without a second searchCatalog call', async () => {
    const discogsCatalog = fakeCatalog();
    const { suggestCatalogMatches } = createSuggestCatalogMatchesUseCase({
      discogsCatalog,
      cache: recordingCache(),
    });

    const first = await suggestCatalogMatches(CREDENTIAL, 'Iron Maiden');
    const second = await suggestCatalogMatches(CREDENTIAL, 'Iron Maiden');

    expect(second).toEqual(first);
    expect(discogsCatalog.searchCatalog).toHaveBeenCalledTimes(1);
  });

  it('collapses different spellings of the same query onto that one cache entry', async () => {
    const discogsCatalog = fakeCatalog();
    const { suggestCatalogMatches } = createSuggestCatalogMatchesUseCase({
      discogsCatalog,
      cache: recordingCache(),
    });

    await suggestCatalogMatches(CREDENTIAL, 'Iron Maiden');
    await suggestCatalogMatches(CREDENTIAL, 'iron  maiden ');
    await suggestCatalogMatches(CREDENTIAL, '  IRON MAIDEN');

    expect(discogsCatalog.searchCatalog).toHaveBeenCalledTimes(1);
  });

  it('caches the shaped 5-item payload, not the 20 raw hits (research D5)', async () => {
    const cache = recordingCache();
    const { suggestCatalogMatches } = createSuggestCatalogMatchesUseCase({
      discogsCatalog: fakeCatalog(upstreamPage(4, 16)),
      cache,
    });

    await suggestCatalogMatches(CREDENTIAL, 'Iron Maiden');

    const cached = cache.store.get('discogs:suggest:iron maiden') as Array<
      Record<string, unknown>
    >;
    expect(cached).toHaveLength(5);
    // The narrow suggestion projection (data-model §2), not the raw hits:
    // no `formats` array, no `communityRating`, a single `format` string.
    expect(cached.every((item) => !('formats' in item) && !('communityRating' in item))).toBe(
      true,
    );
    expect(cached.filter((item) => item.resultType !== 'artist')).toEqual(
      expect.arrayContaining([expect.objectContaining({ format: 'Vinyl' })]),
    );
  });
});

describe('suggestCatalogMatches: short queries short-circuit (FR-010)', () => {
  it.each<[string, string]>([
    ['a single character', 'i'],
    ['two spaces', '  '],
    ['the empty string', ''],
    ['one character padded with whitespace', '  a  '],
  ])('returns [] for %s without touching the cache or the catalog port', async (_label, query) => {
    const cache = recordingCache();
    const discogsCatalog = fakeCatalog();
    const { suggestCatalogMatches } = createSuggestCatalogMatchesUseCase({
      discogsCatalog,
      cache,
    });

    await expect(suggestCatalogMatches(CREDENTIAL, query)).resolves.toEqual([]);
    expect(cache.calls).toHaveLength(0);
    expect(discogsCatalog.searchCatalog).not.toHaveBeenCalled();
  });
});

describe('suggestCatalogMatches: cache outage is fail-soft (CachePort contract)', () => {
  it('still returns the correct suggestions, at one upstream call, when the cache serves nothing', async () => {
    const discogsCatalog = fakeCatalog(upstreamPage(4, 9));
    const { suggestCatalogMatches } = createSuggestCatalogMatchesUseCase({
      discogsCatalog,
      cache: outageCache(),
    });

    const suggestions = await suggestCatalogMatches(CREDENTIAL, 'Iron Maiden');

    expect(suggestions.map((s) => s.discogsId)).toEqual([1000, 1001, 2000, 2001, 2002]);
    expect(discogsCatalog.searchCatalog).toHaveBeenCalledTimes(1);
  });

  it('keeps succeeding on a repeat lookup during the outage (one upstream call each, no error)', async () => {
    const discogsCatalog = fakeCatalog(upstreamPage(4, 9));
    const { suggestCatalogMatches } = createSuggestCatalogMatchesUseCase({
      discogsCatalog,
      cache: outageCache(),
    });

    const first = await suggestCatalogMatches(CREDENTIAL, 'Iron Maiden');
    const second = await suggestCatalogMatches(CREDENTIAL, 'Iron Maiden');

    expect(second).toEqual(first);
    expect(discogsCatalog.searchCatalog).toHaveBeenCalledTimes(2);
  });
});

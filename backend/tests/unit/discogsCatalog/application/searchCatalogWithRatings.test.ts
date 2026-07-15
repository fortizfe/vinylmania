import { createSearchCatalogWithRatingsUseCase } from '../../../../src/application/discogsCatalog/searchCatalogWithRatings';
import type {
  Artist,
  CatalogSearchResponse,
  CatalogSearchResult,
  CommunityRating,
  MasterRelease,
  MasterReleaseVersionsPage,
  Release,
} from '../../../../src/domain/discogsCatalog/types';
import type { CachePort } from '../../../../src/ports/cache/cachePort';
import type {
  DiscogsCatalogPort,
  SearchCatalogOptions,
} from '../../../../src/ports/discogsCatalog/discogsCatalogPort';

function fakeCache(): jest.Mocked<CachePort> {
  return {
    has: jest.fn().mockResolvedValue(false),
    set: jest.fn().mockResolvedValue(undefined),
    // Passthrough: this test is about enrichment, not caching mechanics.
    withCache: jest.fn().mockImplementation((_key, _ttl, fetcher) => fetcher()),
  };
}

function searchResult(overrides: Partial<CatalogSearchResult> = {}): CatalogSearchResult {
  return {
    discogsId: 1,
    resultType: 'release',
    title: 'Stockholm',
    ...overrides,
  };
}

function searchResponse(results: CatalogSearchResult[]): CatalogSearchResponse {
  return {
    results,
    pagination: { page: 1, pages: 1, items: results.length, perPage: 50 },
  };
}

function rating(overrides: Partial<CommunityRating> = {}): CommunityRating {
  return { average: 4.5, count: 10, ...overrides };
}

interface FakeCatalogPortOptions {
  searchResults: CatalogSearchResult[];
  masters?: Record<number, MasterRelease>;
  ratings?: Record<number, CommunityRating | Error>;
  onRatingLookup?: (releaseId: number) => void;
}

function fakeDiscogsCatalog(options: FakeCatalogPortOptions): jest.Mocked<DiscogsCatalogPort> {
  const { searchResults, masters = {}, ratings = {}, onRatingLookup } = options;

  return {
    getRelease: jest.fn<Promise<Release>, [number]>(),
    getArtist: jest.fn<Promise<Artist>, [number]>(),
    getMasterRelease: jest.fn(async (masterId: number): Promise<MasterRelease> => {
      const master = masters[masterId];
      if (!master) {
        throw new Error(`no fake master registered for ${masterId}`);
      }
      return master;
    }),
    getMasterReleaseVersions: jest.fn<Promise<MasterReleaseVersionsPage>, [number, number?, number?]>(),
    getReleaseRating: jest.fn(async (releaseId: number): Promise<CommunityRating> => {
      onRatingLookup?.(releaseId);
      const outcome = ratings[releaseId];
      if (outcome instanceof Error) {
        throw outcome;
      }
      if (!outcome) {
        throw new Error(`no fake rating registered for ${releaseId}`);
      }
      return outcome;
    }),
    searchCatalog: jest.fn(
      async (_query: string, _options?: SearchCatalogOptions): Promise<CatalogSearchResponse> =>
        searchResponse(searchResults),
    ),
  };
}

describe('searchCatalogWithRatings', () => {
  it("attaches a release-type result's own community rating", async () => {
    const discogsCatalog = fakeDiscogsCatalog({
      searchResults: [searchResult({ discogsId: 501, resultType: 'release' })],
      ratings: { 501: rating({ average: 4.2, count: 7 }) },
    });
    const { searchCatalogWithRatings } = createSearchCatalogWithRatingsUseCase({
      discogsCatalog,
      cache: fakeCache(),
    });

    const result = await searchCatalogWithRatings('Stockholm');

    expect(discogsCatalog.getReleaseRating).toHaveBeenCalledWith(501);
    expect(result.results[0].communityRating).toEqual({ average: 4.2, count: 7 });
  });

  it("resolves a master-type result's rating via getMasterRelease(...).mainReleaseId first", async () => {
    const discogsCatalog = fakeDiscogsCatalog({
      searchResults: [searchResult({ discogsId: 13540, resultType: 'master' })],
      masters: {
        13540: {
          discogsId: 13540,
          title: 'Master Title',
          artists: [],
          genres: [],
          styles: [],
          images: [],
          tracklist: [],
          mainReleaseId: 249504,
          discogsUrl: 'https://discogs.com/master/13540',
        },
      },
      ratings: { 249504: rating({ average: 4.8, count: 20 }) },
    });
    const { searchCatalogWithRatings } = createSearchCatalogWithRatingsUseCase({
      discogsCatalog,
      cache: fakeCache(),
    });

    const result = await searchCatalogWithRatings('Nevermind');

    expect(discogsCatalog.getMasterRelease).toHaveBeenCalledWith(13540);
    expect(discogsCatalog.getReleaseRating).toHaveBeenCalledWith(249504);
    expect(result.results[0].communityRating).toEqual({ average: 4.8, count: 20 });
  });

  it('degrades a single failed/slow per-result lookup to no rating without rejecting the whole search', async () => {
    const discogsCatalog = fakeDiscogsCatalog({
      searchResults: [
        searchResult({ discogsId: 1, resultType: 'release' }),
        searchResult({ discogsId: 2, resultType: 'release' }),
      ],
      ratings: {
        1: rating({ average: 3.5, count: 4 }),
        2: new Error('rating lookup failed'),
      },
    });
    const { searchCatalogWithRatings } = createSearchCatalogWithRatingsUseCase({
      discogsCatalog,
      cache: fakeCache(),
    });

    const result = await searchCatalogWithRatings('Query');

    expect(result.results).toHaveLength(2);
    expect(result.results.find((r) => r.discogsId === 1)?.communityRating).toEqual({
      average: 3.5,
      count: 4,
    });
    expect(result.results.find((r) => r.discogsId === 2)?.communityRating).toBeUndefined();
  });

  it('never exceeds a concurrency bound of 5 in-flight rating lookups for a page with more eligible results', async () => {
    const eligibleCount = 9;
    const searchResults = Array.from({ length: eligibleCount }, (_, i) =>
      searchResult({ discogsId: i + 1, resultType: 'release' }),
    );
    const ratings = Object.fromEntries(
      searchResults.map((r) => [r.discogsId, rating()]),
    ) as Record<number, CommunityRating>;

    let inFlight = 0;
    let maxInFlight = 0;

    const discogsCatalog = fakeDiscogsCatalog({
      searchResults,
      ratings,
    });
    discogsCatalog.getReleaseRating.mockImplementation(async (releaseId: number) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return ratings[releaseId];
    });

    const { searchCatalogWithRatings } = createSearchCatalogWithRatingsUseCase({
      discogsCatalog,
      cache: fakeCache(),
    });

    const result = await searchCatalogWithRatings('Query');

    expect(result.results).toHaveLength(eligibleCount);
    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(maxInFlight).toBeGreaterThan(1);
  });
});

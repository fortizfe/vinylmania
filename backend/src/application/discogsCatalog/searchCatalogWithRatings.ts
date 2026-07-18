import { logger } from '../../config/logger';
import type {
  CatalogCredential,
  CatalogSearchResponse,
  CatalogSearchResult,
} from '../../domain/discogsCatalog/types';
import type { CachePort } from '../../ports/cache/cachePort';
import type {
  DiscogsCatalogPort,
  SearchCatalogOptions,
} from '../../ports/discogsCatalog/discogsCatalogPort';
import { mapWithConcurrency } from '../../shared/concurrency';

// Discogs catalog data changes rarely, so search results (which can shift
// as the catalog grows) get a shorter TTL than individual release/artist
// lookups (which are effectively immutable once published).
const SEARCH_CACHE_TTL_SECONDS = 30 * 60;

// Spec FR-009/FR-010 (feature 040, US2): bounds how many rating/master
// lookups a single search's enrichment fan-out can have in flight at once,
// matching libraryEnrichment.ts's existing ENRICHMENT_CONCURRENCY — the
// single largest known source of Discogs request bursts.
const SEARCH_RATING_CONCURRENCY = 5;

/** Trims a filter value; blank/whitespace-only values are treated as unset (spec FR-010). */
function normalizeFilterValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export interface SearchCatalogWithRatingsUseCase {
  searchCatalogWithRatings(
    credential: CatalogCredential,
    query: string,
    options?: SearchCatalogOptions,
  ): Promise<CatalogSearchResponse>;
}

export function createSearchCatalogWithRatingsUseCase(deps: {
  discogsCatalog: DiscogsCatalogPort;
  cache: CachePort;
}): SearchCatalogWithRatingsUseCase {
  const { discogsCatalog, cache } = deps;

  /**
   * Enriches one release- or master-type search result with its community
   * rating (a master's rating is that of its main/key release — Discogs has
   * no master-level rating endpoint, spec Clarifications). Any failure (not
   * found, rate-limited, unavailable, or a lookup exceeding the 2-second
   * timeout) degrades to omitting `communityRating` rather than failing the
   * search response (spec FR-008/SC-006, feature 026 FR-002).
   */
  async function enrichWithRating(
    credential: CatalogCredential,
    result: CatalogSearchResult,
  ): Promise<CatalogSearchResult> {
    if (result.resultType !== 'release' && result.resultType !== 'master') {
      return result;
    }

    try {
      const releaseId =
        result.resultType === 'master'
          ? (await discogsCatalog.getMasterRelease(credential, result.discogsId)).mainReleaseId
          : result.discogsId;
      const rating = await discogsCatalog.getReleaseRating(credential, releaseId);
      if (rating.count <= 0) {
        return result;
      }
      return { ...result, communityRating: rating };
    } catch (err) {
      logger.warn({
        route: 'discogs:rating',
        outcome: 'omitted',
        meta: { discogsReleaseId: result.discogsId, resultType: result.resultType },
        message: err instanceof Error ? err.message : 'unknown error',
      });
      return result;
    }
  }

  async function searchCatalogWithRatings(
    credential: CatalogCredential,
    query: string,
    options: SearchCatalogOptions = {},
  ): Promise<CatalogSearchResponse> {
    if (!query.trim()) {
      return { results: [], pagination: { page: 1, pages: 0, items: 0, perPage: 0 } };
    }

    // `credential` is resolved once by the caller (the route) and threaded
    // through the raw search call and every enrichment fan-out call below —
    // never re-resolved per Discogs call (spec 053, research.md Decision 3).
    const resultType = options.resultType ?? '';
    const page = options.page ?? 1;
    const perPage = options.perPage ?? 50;
    const genre = normalizeFilterValue(options.genre);
    const style = normalizeFilterValue(options.style);
    const format = normalizeFilterValue(options.format);
    // Cache-aside key includes every filter segment (empty when unset) so
    // filtered and unfiltered searches for the same query/page never collide.
    const cacheKey = `discogs:search:${resultType}:${query}:${page}:${perPage}:${genre ?? ''}:${style ?? ''}:${format ?? ''}`;

    return cache.withCache(cacheKey, SEARCH_CACHE_TTL_SECONDS, async () => {
      const raw = await discogsCatalog.searchCatalog(credential, query, options);
      const enrichedResults = await mapWithConcurrency(
        raw.results,
        SEARCH_RATING_CONCURRENCY,
        (result) => enrichWithRating(credential, result),
      );

      return { results: enrichedResults, pagination: raw.pagination };
    });
  }

  return { searchCatalogWithRatings };
}

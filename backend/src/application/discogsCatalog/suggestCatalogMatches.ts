import { allocateSuggestions } from '../../domain/discogsCatalog/suggestionQuota';
import type { CatalogCredential, CatalogSuggestion } from '../../domain/discogsCatalog/types';
import type { CachePort } from '../../ports/cache/cachePort';
import type { DiscogsCatalogPort } from '../../ports/discogsCatalog/discogsCatalogPort';

// Feature 069, research D5: short enough that a catalog addition shows up
// in the panel the same session, long enough that a pause-and-retype costs
// nothing upstream (spec FR-017).
const SUGGEST_CACHE_TTL_SECONDS = 300;

// One upstream page, deep enough that the 2 + 3 quota can almost always be
// filled from it (tasks assumption 3) at exactly one request per miss.
const SUGGEST_PAGE_SIZE = 20;

// Below this, the panel has nothing useful to propose (spec FR-010); the
// client already gates on it, this is the server-side guard.
const MIN_QUERY_LENGTH = 2;

/** Trim, collapse internal whitespace, lower-case — cache-key normalisation only. */
function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

interface SuggestCatalogMatchesUseCase {
  suggestCatalogMatches(
    credential: CatalogCredential,
    query: string,
  ): Promise<CatalogSuggestion[]>;
}

export function createSuggestCatalogMatchesUseCase(deps: {
  discogsCatalog: DiscogsCatalogPort;
  cache: CachePort;
}): SuggestCatalogMatchesUseCase {
  const { discogsCatalog, cache } = deps;

  /**
   * One upstream `/database/search` per cache miss, shaped down to at most
   * five suggestions before it is cached — no rating enrichment, so
   * `searchCatalogWithRatings` is deliberately *not* on this path (spec
   * FR-016/FR-017, SC-011; research D3).
   */
  async function suggestCatalogMatches(
    credential: CatalogCredential,
    query: string,
  ): Promise<CatalogSuggestion[]> {
    const normalized = normalizeQuery(query);
    if (normalized.length < MIN_QUERY_LENGTH) {
      return [];
    }

    // ponytail: the suggest cache entry is shared across collectors (no credential in the key, matching discogs:search:*); ceiling is Discogs personalising /database/search; upgrade path is adding the credential type to the key
    return cache.withCache(`discogs:suggest:${normalized}`, SUGGEST_CACHE_TTL_SECONDS, async () => {
      // The raw query goes upstream — only the cache key is normalised.
      const raw = await discogsCatalog.searchCatalog(credential, query, {
        resultType: 'any',
        page: 1,
        perPage: SUGGEST_PAGE_SIZE,
      });
      return allocateSuggestions(raw.results);
    });
  }

  return { suggestCatalogMatches };
}

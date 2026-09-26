import {
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryResult,
  type InfiniteData,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { SearchFilters } from '../hooks/useSearchQueryParams';
import * as discogsApi from '../services/discogsApi';
import type {
  CatalogSearchResponse,
  CatalogSuggestion,
  MasterRelease,
  MasterReleaseVersionsPage,
} from '../services/discogsApi';
import type { Release } from '../services/libraryApi';

export const discogsKeys = {
  all: ['discogs'] as const,
  search: (
    query: string,
    type: 'release' | 'artist',
    page?: number,
    perPage?: number,
    filters?: SearchFilters,
  ) => [...discogsKeys.all, 'search', type, query, page, perPage, filters] as const,
  // Excludes `page` from the key (unlike `search` above) so every page fetched
  // for the same query/filters accumulates in one cache entry, as
  // useInfiniteQuery expects (feature 027, US2).
  searchInfinite: (
    query: string,
    type: 'release' | 'artist',
    perPage?: number,
    filters?: SearchFilters,
  ) => [...discogsKeys.all, 'search-infinite', type, query, perPage, filters] as const,
  release: (discogsId: number) => [...discogsKeys.all, 'release', discogsId] as const,
  master: (discogsId: number) => [...discogsKeys.all, 'master', discogsId] as const,
  masterVersions: (discogsId: number, page?: number) =>
    [...discogsKeys.all, 'master-versions', discogsId, page] as const,
  // Trimmed, so padding cannot fragment the cache; keyed per query string so
  // a superseded lookup lands in its own entry and is never read (069,
  // data-model §4 "staleness is structural").
  suggest: (query: string) => [...discogsKeys.all, 'suggest', query.trim()] as const,
};

/**
 * Infinite-scroll variant of catalog search (feature 027, US2): accumulates
 * pages of `perPage` results as `fetchNextPage` is called, replacing the
 * previous discrete-page `useCatalogSearch`/Previous-Next pagination.
 */
export function useCatalogSearchInfinite(
  query: string,
  type: 'release' | 'artist',
  perPage?: number,
  filters?: SearchFilters,
): UseInfiniteQueryResult<InfiniteData<CatalogSearchResponse>> {
  return useInfiniteQuery({
    queryKey: discogsKeys.searchInfinite(query, type, perPage, filters),
    queryFn: ({ pageParam }) =>
      discogsApi.search(query, type, pageParam, perPage, filters),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.pages
        ? lastPage.pagination.page + 1
        : undefined,
    enabled: query.trim().length > 0,
  });
}

export function useCatalogRelease(
  discogsId: number | undefined,
): UseQueryResult<Release> {
  return useQuery({
    queryKey: discogsKeys.release(discogsId ?? -1),
    queryFn: () => discogsApi.getRelease(discogsId ?? -1),
    enabled: discogsId !== undefined,
    // A 404 (release removed/never existed) is a terminal state, not a
    // transient failure — retrying just delays the not-found state (spec
    // FR-015), matching the existing useLibraryEntry convention.
    retry: false,
  });
}

export function useCatalogMaster(
  discogsId: number | undefined,
): UseQueryResult<MasterRelease> {
  return useQuery({
    queryKey: discogsKeys.master(discogsId ?? -1),
    queryFn: () => discogsApi.getMasterRelease(discogsId ?? -1),
    enabled: discogsId !== undefined,
    retry: false,
  });
}

export function useCatalogMasterVersions(
  discogsId: number | undefined,
  page?: number,
): UseQueryResult<MasterReleaseVersionsPage> {
  return useQuery({
    queryKey: discogsKeys.masterVersions(discogsId ?? -1, page),
    queryFn: () => discogsApi.getMasterReleaseVersions(discogsId ?? -1, page),
    enabled: discogsId !== undefined,
    retry: false,
  });
}

/**
 * Header suggestion lookups (069 US2, research D8). `enabled` carries the
 * caller's own gate (has the collector edited the field yet?); the two-character
 * floor is enforced here so no caller can spend a request on one letter.
 */
export function useCatalogSuggestions(
  query: string,
  enabled: boolean,
): UseQueryResult<CatalogSuggestion[]> {
  return useQuery({
    queryKey: discogsKeys.suggest(query),
    queryFn: () => discogsApi.suggest(query),
    enabled: enabled && query.trim().length >= 2,
    // The panel is a typing aid: re-typing the same query inside five minutes
    // must cost nothing (FR-017).
    staleTime: 5 * 60_000,
    // A failed suggestion is disposable — surface it and offer Retry rather
    // than holding the panel in `loading` through a retry ladder (FR-019).
    retry: false,
  });
}

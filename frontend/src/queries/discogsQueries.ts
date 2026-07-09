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

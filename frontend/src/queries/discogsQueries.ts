import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { SearchFilters } from '../hooks/useSearchQueryParams';
import * as discogsApi from '../services/discogsApi';
import type { CatalogSearchResponse } from '../services/discogsApi';
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
  release: (discogsId: number) => [...discogsKeys.all, 'release', discogsId] as const,
};

export function useCatalogSearch(
  query: string,
  type: 'release' | 'artist',
  page?: number,
  perPage?: number,
  filters?: SearchFilters,
): UseQueryResult<CatalogSearchResponse> {
  return useQuery({
    queryKey: discogsKeys.search(query, type, page, perPage, filters),
    queryFn: () => discogsApi.search(query, type, page, perPage, filters),
    enabled: query.trim().length > 0,
  });
}

export function useCatalogRelease(discogsId: number | undefined): UseQueryResult<Release> {
  return useQuery({
    queryKey: discogsKeys.release(discogsId ?? -1),
    queryFn: () => discogsApi.getRelease(discogsId ?? -1),
    enabled: discogsId !== undefined,
  });
}

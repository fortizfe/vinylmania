import { useQuery, type UseQueryResult } from '@tanstack/react-query';

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
  release: (discogsId: number) => [...discogsKeys.all, 'release', discogsId] as const,
  master: (discogsId: number) => [...discogsKeys.all, 'master', discogsId] as const,
  masterVersions: (discogsId: number, page?: number) =>
    [...discogsKeys.all, 'master-versions', discogsId, page] as const,
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
    // A 404 (release removed/never existed) is a terminal state, not a
    // transient failure — retrying just delays the not-found state (spec
    // FR-015), matching the existing useLibraryEntry convention.
    retry: false,
  });
}

export function useCatalogMaster(discogsId: number | undefined): UseQueryResult<MasterRelease> {
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

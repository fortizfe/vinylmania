import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  DEFAULT_LIBRARY_SORT,
  type LibrarySortValue,
} from '../constants/librarySortOptions';
import type { LibraryFilters } from '../hooks/useLibraryQueryParams';
import * as libraryApi from '../services/libraryApi';
import type {
  EnrichedLibraryEntry,
  PaginatedLibraryEntries,
  UpdateCopyDataPatch,
} from '../services/libraryApi';
import { wantlistKeys } from './wantlistQueries';

/** One batch per request (research D8); the page number is an internal cursor. */
const PAGE_SIZE = 20;

export const libraryKeys = {
  all: ['library'] as const,
  lists: () => [...libraryKeys.all, 'list'] as const,
  /**
   * Feature 068 (D8): no page — one key holds every loaded batch, so two
   * sorts or filter sets never share a cache entry and a late response for an
   * abandoned selection can never render under the current one (FR-015).
   */
  list: (sort: LibrarySortValue = DEFAULT_LIBRARY_SORT, filters: LibraryFilters = {}) =>
    [...libraryKeys.lists(), sort, filters] as const,
  details: () => [...libraryKeys.all, 'detail'] as const,
  detail: (entryId: string) => [...libraryKeys.details(), entryId] as const,
};

export function useLibraryList(
  sort: LibrarySortValue = DEFAULT_LIBRARY_SORT,
  filters: LibraryFilters = {},
): UseInfiniteQueryResult<InfiniteData<PaginatedLibraryEntries>> {
  return useInfiniteQuery({
    queryKey: libraryKeys.list(sort, filters),
    queryFn: ({ pageParam }) =>
      libraryApi.list(pageParam, PAGE_SIZE, false, filters, sort),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.totalItems ? last.page + 1 : undefined,
    retry: false,
  });
}

/**
 * Forces a fresh Discogs synchronization and resets the list to its first
 * batch for the current sort and filters (FR-014, research D10).
 */
export function useRefreshLibrary(
  sort: LibrarySortValue = DEFAULT_LIBRARY_SORT,
  filters: LibraryFilters = {},
): UseMutationResult<PaginatedLibraryEntries, unknown, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => libraryApi.list(1, PAGE_SIZE, true, filters, sort),
    onSuccess: (data) => {
      queryClient.setQueryData(libraryKeys.list(sort, filters), {
        pages: [data],
        pageParams: [1],
      });
    },
  });
}

export function useLibraryEntry(
  entryId: string | undefined,
): UseQueryResult<EnrichedLibraryEntry> {
  return useQuery({
    queryKey: libraryKeys.detail(entryId ?? ''),
    queryFn: () => libraryApi.getOne(entryId ?? ''),
    enabled: entryId !== undefined,
    retry: false,
  });
}

/**
 * Persists one per-copy field (rating, media/sleeve condition, or notes) to
 * the user's Discogs collection — the detail panel autosaves per field.
 */
export function useUpdateLibraryEntry(
  entryId: string,
): UseMutationResult<EnrichedLibraryEntry, unknown, UpdateCopyDataPatch> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: UpdateCopyDataPatch) => libraryApi.update(entryId, patch),
    onSuccess: () => {
      // ponytail: invalidateQueries refetches every loaded page after a
      // mutation; upgrade to resetQueries(lists) if deep scrolls + edits get
      // slow.
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    },
  });
}

export function useRemoveLibraryEntry(): UseMutationResult<void, unknown, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entryId: string) => libraryApi.remove(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    },
  });
}

interface CreateLibraryEntryArgs {
  discogsReleaseId: number;
}

export function useCreateLibraryEntry(): UseMutationResult<
  EnrichedLibraryEntry,
  unknown,
  CreateLibraryEntryArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ discogsReleaseId }: CreateLibraryEntryArgs) =>
      libraryApi.create(discogsReleaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      // Feature 060, FR-012: a purchased release is auto-removed from the
      // Discogs wantlist, so drop the cached wantlist immediately.
      queryClient.invalidateQueries({ queryKey: wantlistKeys.all });
    },
  });
}

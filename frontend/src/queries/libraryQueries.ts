import {
  useMutation,
  useQuery,
  useQueryClient,
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

export const libraryKeys = {
  all: ['library'] as const,
  lists: () => [...libraryKeys.all, 'list'] as const,
  list: (
    page: number,
    pageSize: number,
    filters: LibraryFilters = {},
    sort: LibrarySortValue = DEFAULT_LIBRARY_SORT,
  ) => [...libraryKeys.lists(), page, pageSize, filters, sort] as const,
  details: () => [...libraryKeys.all, 'detail'] as const,
  detail: (entryId: string) => [...libraryKeys.details(), entryId] as const,
};

export function useLibraryList(
  page: number,
  pageSize: number,
  filters: LibraryFilters = {},
  sort: LibrarySortValue = DEFAULT_LIBRARY_SORT,
): UseQueryResult<PaginatedLibraryEntries> {
  return useQuery({
    queryKey: libraryKeys.list(page, pageSize, filters, sort),
    queryFn: () => libraryApi.list(page, pageSize, false, filters, sort),
    retry: false,
  });
}

/** Forces a fresh Discogs synchronization for the current page and sort (FR-014). */
export function useRefreshLibrary(
  page: number,
  pageSize: number,
  filters: LibraryFilters = {},
  sort: LibrarySortValue = DEFAULT_LIBRARY_SORT,
): UseMutationResult<PaginatedLibraryEntries, unknown, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => libraryApi.list(page, pageSize, true, filters, sort),
    onSuccess: (data) => {
      queryClient.setQueryData(libraryKeys.list(page, pageSize, filters, sort), data);
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

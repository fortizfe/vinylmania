import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import * as libraryApi from '../services/libraryApi';
import type { EnrichedLibraryEntry, PaginatedLibraryEntries } from '../services/libraryApi';

export const libraryKeys = {
  all: ['library'] as const,
  lists: () => [...libraryKeys.all, 'list'] as const,
  list: (page: number, pageSize: number) => [...libraryKeys.lists(), page, pageSize] as const,
  details: () => [...libraryKeys.all, 'detail'] as const,
  detail: (entryId: string) => [...libraryKeys.details(), entryId] as const,
};

export function useLibraryList(page: number, pageSize: number): UseQueryResult<PaginatedLibraryEntries> {
  return useQuery({
    queryKey: libraryKeys.list(page, pageSize),
    queryFn: () => libraryApi.list(page, pageSize),
  });
}

export function useLibraryEntry(entryId: string | undefined): UseQueryResult<EnrichedLibraryEntry> {
  return useQuery({
    queryKey: libraryKeys.detail(entryId ?? ''),
    queryFn: () => libraryApi.getOne(entryId ?? ''),
    enabled: entryId !== undefined,
  });
}

export interface UpdateLibraryEntryArgs {
  condition?: string;
  notes?: string;
}

export function useUpdateLibraryEntry(
  entryId: string,
): UseMutationResult<EnrichedLibraryEntry, unknown, UpdateLibraryEntryArgs> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ condition, notes }: UpdateLibraryEntryArgs) =>
      notes === undefined
        ? libraryApi.update(entryId, condition)
        : libraryApi.update(entryId, condition, notes),
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

export interface CreateLibraryEntryArgs {
  discogsReleaseId: number;
  condition?: string;
  notes?: string;
}

export function useCreateLibraryEntry(): UseMutationResult<
  EnrichedLibraryEntry,
  unknown,
  CreateLibraryEntryArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ discogsReleaseId, condition, notes }: CreateLibraryEntryArgs) => {
      if (notes !== undefined) return libraryApi.create(discogsReleaseId, condition, notes);
      if (condition !== undefined) return libraryApi.create(discogsReleaseId, condition);
      return libraryApi.create(discogsReleaseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    },
  });
}

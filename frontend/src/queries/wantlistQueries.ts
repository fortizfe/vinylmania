import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import * as wantlistApi from '../services/wantlistApi';
import type {
  AddToWantlistResult,
  PaginatedWantlist,
  UpdateWantEntryPatch,
  WantEntryDetail,
} from '../services/wantlistApi';

export const wantlistKeys = {
  all: ['wantlist'] as const,
  lists: () => [...wantlistKeys.all, 'list'] as const,
  list: (page: number, pageSize: number) =>
    [...wantlistKeys.lists(), page, pageSize] as const,
  details: () => [...wantlistKeys.all, 'detail'] as const,
  detail: (releaseId: number) => [...wantlistKeys.details(), releaseId] as const,
};

export function useWantlist(
  page: number,
  pageSize: number,
): UseQueryResult<PaginatedWantlist> {
  return useQuery({
    queryKey: wantlistKeys.list(page, pageSize),
    queryFn: () => wantlistApi.list(page, pageSize, false),
    retry: false,
  });
}

/** Forces a fresh Discogs synchronization for the current page (FR-014). */
export function useRefreshWantlist(
  page: number,
  pageSize: number,
): UseMutationResult<PaginatedWantlist, unknown, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => wantlistApi.list(page, pageSize, true),
    onSuccess: (data) => {
      queryClient.setQueryData(wantlistKeys.list(page, pageSize), data);
    },
  });
}

export function useWantlistEntry(
  releaseId: number | undefined,
): UseQueryResult<WantEntryDetail> {
  return useQuery({
    queryKey: wantlistKeys.detail(releaseId ?? 0),
    queryFn: () => wantlistApi.getOne(releaseId ?? 0),
    enabled: releaseId !== undefined,
    retry: false,
  });
}

export interface AddToWantlistArgs {
  discogsReleaseId: number;
}

export function useAddToWantlist(): UseMutationResult<
  AddToWantlistResult,
  unknown,
  AddToWantlistArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ discogsReleaseId }: AddToWantlistArgs) =>
      wantlistApi.add(discogsReleaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wantlistKeys.all });
    },
  });
}

/**
 * Persists one wantlist-entry field (rating or notes) to the user's Discogs
 * wantlist — the detail panel autosaves per field.
 */
export function useUpdateWantEntry(
  releaseId: number,
): UseMutationResult<WantEntryDetail, unknown, UpdateWantEntryPatch> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: UpdateWantEntryPatch) => wantlistApi.update(releaseId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wantlistKeys.all });
    },
  });
}

export function useRemoveFromWantlist(): UseMutationResult<void, unknown, number> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (releaseId: number) => wantlistApi.remove(releaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wantlistKeys.all });
    },
  });
}

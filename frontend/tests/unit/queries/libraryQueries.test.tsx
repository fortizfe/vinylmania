import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../testUtils';

const mockList = vi.fn();
const mockGetOne = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock('../../../src/services/libraryApi', () => ({
  list: (...args: unknown[]) => mockList(...args),
  getOne: (...args: unknown[]) => mockGetOne(...args),
  create: (...args: unknown[]) => mockCreate(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('libraryQueries', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockGetOne.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockRemove.mockReset();
  });

  it('useLibraryList fetches and returns the paginated list', async () => {
    mockList.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0 });

    const { useLibraryList } = await import('../../../src/queries/libraryQueries');
    const { result } = renderHook(() => useLibraryList(1, 20), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockList).toHaveBeenCalledWith(1, 20);
    expect(result.current.data).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
    });
  });

  it('useLibraryEntry stays disabled and issues no request when entryId is undefined', async () => {
    const { useLibraryEntry } = await import('../../../src/queries/libraryQueries');
    const { result } = renderHook(() => useLibraryEntry(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetOne).not.toHaveBeenCalled();
  });

  it('useLibraryEntry serves a second render from cache without refetching', async () => {
    mockGetOne.mockResolvedValue({ id: 'entry-1', discogsReleaseId: 1 });

    // Within staleTime, a remount must be served from cache with no new
    // request — this is the "instant revisit" behavior FR-001/FR-002 require.
    const client = createTestQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 60_000 } });
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { useLibraryEntry } = await import('../../../src/queries/libraryQueries');
    const first = renderHook(() => useLibraryEntry('entry-1'), { wrapper: localWrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

    const second = renderHook(() => useLibraryEntry('entry-1'), {
      wrapper: localWrapper,
    });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(mockGetOne).toHaveBeenCalledTimes(1);
  });

  it('useUpdateLibraryEntry invalidates library queries on success', async () => {
    mockUpdate.mockResolvedValue({ id: 'entry-1', discogsReleaseId: 1, discogs: null });

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { useUpdateLibraryEntry, libraryKeys } =
      await import('../../../src/queries/libraryQueries');
    const { result } = renderHook(() => useUpdateLibraryEntry('entry-1'), {
      wrapper: localWrapper,
    });

    await result.current.mutateAsync({ rating: 4 });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: libraryKeys.all });
  });

  it('useRemoveLibraryEntry invalidates library queries on success', async () => {
    mockRemove.mockResolvedValue(undefined);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { useRemoveLibraryEntry, libraryKeys } =
      await import('../../../src/queries/libraryQueries');
    const { result } = renderHook(() => useRemoveLibraryEntry(), {
      wrapper: localWrapper,
    });

    await result.current.mutateAsync('entry-1');

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: libraryKeys.all });
  });

  it('useCreateLibraryEntry invalidates library queries on success', async () => {
    mockCreate.mockResolvedValue({ id: 'entry-2', discogsReleaseId: 2 });

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { useCreateLibraryEntry, libraryKeys } =
      await import('../../../src/queries/libraryQueries');
    const { result } = renderHook(() => useCreateLibraryEntry(), {
      wrapper: localWrapper,
    });

    await result.current.mutateAsync({ discogsReleaseId: 2 });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: libraryKeys.all });
  });
});

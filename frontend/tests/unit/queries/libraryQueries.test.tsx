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

// Only the real `libraryApi.list` URL test below uses this; every other test
// goes through the `libraryApi` mock above.
const mockAuthorizedFetch = vi.fn();
vi.mock('../../../src/services/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/apiClient')>()),
  authorizedFetch: (...args: unknown[]) => mockAuthorizedFetch(...args),
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

  it('useLibraryList fetches and returns the first batch', async () => {
    mockList.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0 });

    const { useLibraryList } = await import('../../../src/queries/libraryQueries');
    const { result } = renderHook(() => useLibraryList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockList).toHaveBeenCalledWith(
      1,
      20,
      false,
      {},
      { sort: 'added', dir: 'desc' },
    );
    expect(result.current.data?.pages).toEqual([
      { items: [], page: 1, pageSize: 20, totalItems: 0 },
    ]);
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

  it('useCreateLibraryEntry invalidates both library and wantlist queries on success', async () => {
    mockCreate.mockResolvedValue({ id: 'entry-2', discogsReleaseId: 2 });

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { useCreateLibraryEntry, libraryKeys } =
      await import('../../../src/queries/libraryQueries');
    const { wantlistKeys } = await import('../../../src/queries/wantlistQueries');
    const { result } = renderHook(() => useCreateLibraryEntry(), {
      wrapper: localWrapper,
    });

    await result.current.mutateAsync({ discogsReleaseId: 2 });

    // FR-012: buying a wanted record drops it from the wishlist, so the
    // wantlist cache must be invalidated alongside the library cache.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: libraryKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wantlistKeys.all });
  });

  describe('sort (feature 068, US1, FR-002/FR-015)', () => {
    const byArtist = { sort: 'artist', dir: 'asc' } as const;
    const byAlbum = { sort: 'album', dir: 'desc' } as const;

    it('libraryApi.list sends sort and dir query params alongside page and filters', async () => {
      mockAuthorizedFetch.mockResolvedValue({
        json: () => Promise.resolve({ items: [], page: 1, pageSize: 20, totalItems: 0 }),
      });
      const realApi = await vi.importActual<
        typeof import('../../../src/services/libraryApi')
      >('../../../src/services/libraryApi');

      await realApi.list(1, 20, false, { genre: ['Rock'] }, byArtist);

      const [url] = mockAuthorizedFetch.mock.lastCall as [string];
      const [path, query] = url.split('?');
      const params = new URLSearchParams(query);
      expect(path).toBe('/api/library');
      expect(params.get('sort')).toBe('artist');
      expect(params.get('dir')).toBe('asc');
      expect(params.get('genre')).toBe('Rock');
      expect(params.get('page')).toBe('1');
    });

    it('useLibraryList passes the sort to libraryApi.list', async () => {
      mockList.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0 });

      const { useLibraryList } = await import('../../../src/queries/libraryQueries');
      const { result } = renderHook(() => useLibraryList(byArtist), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockList).toHaveBeenCalledWith(1, 20, false, {}, byArtist);
    });

    it('two sorts never share a cache entry (the list key includes the sort)', async () => {
      mockList.mockImplementation((...args: unknown[]) =>
        Promise.resolve({
          items: [
            { id: `for-${(args[4] as { sort?: string } | undefined)?.sort ?? 'none'}` },
          ],
          page: 1,
          pageSize: 20,
          totalItems: 1,
        }),
      );
      const client = createTestQueryClient();
      client.setDefaultOptions({ queries: { retry: false, staleTime: 60_000 } });
      const localWrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );

      const { useLibraryList, libraryKeys } =
        await import('../../../src/queries/libraryQueries');
      const artist = renderHook(() => useLibraryList(byArtist), {
        wrapper: localWrapper,
      });
      await waitFor(() => expect(artist.result.current.isSuccess).toBe(true));
      const album = renderHook(() => useLibraryList(byAlbum), {
        wrapper: localWrapper,
      });
      await waitFor(() => expect(album.result.current.isSuccess).toBe(true));

      expect(mockList).toHaveBeenCalledTimes(2);
      expect(album.result.current.data?.pages[0].items[0]?.id).toBe('for-album');
      expect(artist.result.current.data?.pages[0].items[0]?.id).toBe('for-artist');
      expect(libraryKeys.list(byArtist)).not.toEqual(libraryKeys.list(byAlbum));
    });

    it("useRefreshLibrary forces a sync for the current sort and writes into that sort's cache", async () => {
      const refreshed = { items: [], page: 1, pageSize: 20, totalItems: 0 };
      mockList.mockResolvedValue(refreshed);
      const client = createTestQueryClient();
      const localWrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );

      const { useRefreshLibrary, libraryKeys } =
        await import('../../../src/queries/libraryQueries');
      const { result } = renderHook(() => useRefreshLibrary(byAlbum), {
        wrapper: localWrapper,
      });
      await result.current.mutateAsync();

      expect(mockList).toHaveBeenCalledWith(1, 20, true, {}, byAlbum);
      expect(client.getQueryData(libraryKeys.list(byAlbum))).toEqual({
        pages: [refreshed],
        pageParams: [1],
      });
    });
  });
});

/**
 * Feature 068, US2 (T027) — infinite scroll (research D8/D10, FR-014).
 * The list becomes an infinite query: `useLibraryList(sort, filters)` and
 * `useRefreshLibrary(sort, filters)`, keyed without a page. Page size is a
 * constant (20) inside the query layer, so callers no longer pass it.
 */
describe('libraryQueries — infinite library list (feature 068, US2)', () => {
  const byArtist = { sort: 'artist', dir: 'asc' } as const;

  /** A batch of `count` placeholder entries for page `page`. */
  function batch(page: number, count: number, totalItems: number) {
    return {
      items: Array.from({ length: count }, (_, index) => ({
        id: `p${page}-e${index}`,
      })),
      page,
      pageSize: 20,
      totalItems,
    };
  }

  beforeEach(() => {
    mockList.mockReset();
  });

  it('keys the list by sort and filters only — no page in the key', async () => {
    const { libraryKeys } = await import('../../../src/queries/libraryQueries');

    expect(libraryKeys.list(byArtist, { genre: ['Rock'] })).toEqual([
      ...libraryKeys.lists(),
      byArtist,
      { genre: ['Rock'] },
    ]);
    // A page number must not leak into the key: one key holds every batch.
    expect(libraryKeys.list(byArtist, {}).some((part) => typeof part === 'number')).toBe(
      false,
    );
  });

  it('useLibraryList(sort, filters) is an infinite query holding the first batch', async () => {
    mockList.mockResolvedValue(batch(1, 20, 45));

    const { useLibraryList } = await import('../../../src/queries/libraryQueries');
    const { result } = renderHook(() => useLibraryList(byArtist, { genre: ['Rock'] }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockList).toHaveBeenCalledWith(1, 20, false, { genre: ['Rock'] }, byArtist);
    expect(result.current.data?.pageParams).toEqual([1]);
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('getNextPageParam advances while page * pageSize < totalItems, then stops', async () => {
    mockList.mockImplementation((page: number) =>
      Promise.resolve(batch(page, page === 3 ? 5 : 20, 45)),
    );

    const { useLibraryList } = await import('../../../src/queries/libraryQueries');
    const { result } = renderHook(() => useLibraryList(byArtist), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Reading `data` here is required, not decorative: TanStack only notifies
    // on the result props that have been read, and `renderHook`'s probe reads
    // none during render — without this the later batches never reach
    // `result.current`. It also pins the first batch to exactly one page.
    expect(result.current.data?.pages).toHaveLength(1);

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(mockList).toHaveBeenLastCalledWith(2, 20, false, {}, byArtist);
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(3));
    expect(mockList).toHaveBeenLastCalledWith(3, 20, false, {}, byArtist);
    // 3 * 20 >= 45 — the collection is exhausted.
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(result.current.data?.pageParams).toEqual([1, 2, 3]);
  });

  it('reports no next page when the first batch is the whole collection', async () => {
    mockList.mockResolvedValue(batch(1, 7, 7));

    const { useLibraryList } = await import('../../../src/queries/libraryQueries');
    const { result } = renderHook(() => useLibraryList(byArtist), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('useRefreshLibrary(sort, filters) forces page 1 and resets the cache to that single batch (FR-014, D10)', async () => {
    const page1 = batch(1, 20, 45);
    mockList.mockResolvedValue(page1);
    const client = createTestQueryClient();
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { useRefreshLibrary, libraryKeys } =
      await import('../../../src/queries/libraryQueries');
    const { result } = renderHook(
      () => useRefreshLibrary(byArtist, { genre: ['Rock'] }),
      { wrapper: localWrapper },
    );
    await result.current.mutateAsync();

    expect(mockList).toHaveBeenCalledWith(1, 20, true, { genre: ['Rock'] }, byArtist);
    expect(client.getQueryData(libraryKeys.list(byArtist, { genre: ['Rock'] }))).toEqual({
      pages: [page1],
      pageParams: [1],
    });
  });
});

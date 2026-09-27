import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../testUtils';

const mockSearch = vi.fn();
const mockGetRelease = vi.fn();
const mockSuggest = vi.fn();
const mockAuthorizedFetch = vi.fn();

vi.mock('../../../src/services/discogsApi', () => ({
  search: (...args: unknown[]) => mockSearch(...args),
  getRelease: (...args: unknown[]) => mockGetRelease(...args),
  suggest: (...args: unknown[]) => mockSuggest(...args),
}));

// Only the suggest-route test below reaches the real `discogsApi` (through
// `vi.importActual`); for every other test in this file this mock is inert.
vi.mock('../../../src/services/apiClient', () => ({
  authorizedFetch: (...args: unknown[]) => mockAuthorizedFetch(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('discogsQueries', () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockGetRelease.mockReset();
  });

  it('useCatalogSearchInfinite stays disabled and issues no request for an empty query', async () => {
    const { useCatalogSearchInfinite } =
      await import('../../../src/queries/discogsQueries');
    const { result } = renderHook(() => useCatalogSearchInfinite('', 'release'), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('useCatalogSearchInfinite fetches the first page for a non-empty query', async () => {
    mockSearch.mockResolvedValue({
      results: [],
      pagination: { page: 1, pages: 1, items: 0, perPage: 20 },
    });

    const { useCatalogSearchInfinite } =
      await import('../../../src/queries/discogsQueries');
    const { result } = renderHook(
      () => useCatalogSearchInfinite('aphex twin', 'release', 20),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSearch).toHaveBeenCalledWith('aphex twin', 'release', 1, 20, undefined);
  });

  it('useCatalogSearchInfinite fetches the next page (FR-005) and stops once pages are exhausted (FR-008)', async () => {
    mockSearch.mockResolvedValueOnce({
      results: [],
      pagination: { page: 1, pages: 2, items: 21, perPage: 20 },
    });

    const { useCatalogSearchInfinite } =
      await import('../../../src/queries/discogsQueries');
    const { result } = renderHook(
      () => useCatalogSearchInfinite('aphex twin', 'release', 20),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    mockSearch.mockResolvedValueOnce({
      results: [],
      pagination: { page: 2, pages: 2, items: 21, perPage: 20 },
    });
    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages.length).toBe(2));
    expect(mockSearch).toHaveBeenLastCalledWith(
      'aphex twin',
      'release',
      2,
      20,
      undefined,
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it('useCatalogSearchInfinite forwards filters to discogsApi.search and keys distinct filter combinations separately, independent of page (feature 021, 027)', async () => {
    mockSearch.mockResolvedValue({
      results: [],
      pagination: { page: 1, pages: 1, items: 0, perPage: 20 },
    });

    const { useCatalogSearchInfinite, discogsKeys } =
      await import('../../../src/queries/discogsQueries');
    const filters = { genre: 'Rock', format: ['Vinyl'] };
    const { result } = renderHook(
      () => useCatalogSearchInfinite('aphex twin', 'release', 20, filters),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSearch).toHaveBeenCalledWith('aphex twin', 'release', 1, 20, filters);
    expect(discogsKeys.searchInfinite('aphex twin', 'release', 20, filters)).not.toEqual(
      discogsKeys.searchInfinite('aphex twin', 'release', 20, undefined),
    );
    // The infinite-query key must not vary by page (FR-009): appending more
    // pages must not fragment the cache entry for the same query/filters.
    expect(discogsKeys.searchInfinite('aphex twin', 'release', 20, filters)).toEqual(
      discogsKeys.searchInfinite('aphex twin', 'release', 20, filters),
    );
  });

  it('useCatalogRelease serves a second render from cache without refetching', async () => {
    mockGetRelease.mockResolvedValue({ discogsId: 1, title: 'Stockholm' });

    // Within staleTime, a remount must be served from cache with no new
    // request — this is the "instant revisit" behavior FR-001/FR-002 require.
    const client = createTestQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 60_000 } });
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { useCatalogRelease } = await import('../../../src/queries/discogsQueries');
    const first = renderHook(() => useCatalogRelease(1), { wrapper: localWrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

    const second = renderHook(() => useCatalogRelease(1), { wrapper: localWrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(mockGetRelease).toHaveBeenCalledTimes(1);
  });

  it('useCatalogRelease stays disabled when discogsId is undefined', async () => {
    const { useCatalogRelease } = await import('../../../src/queries/discogsQueries');
    const { result } = renderHook(() => useCatalogRelease(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetRelease).not.toHaveBeenCalled();
  });
});

// --- 069 US2: header suggestion lookups (research D8) ----------------------

describe('discogsQueries — header suggestions (069 US2)', () => {
  beforeEach(() => {
    mockSuggest.mockReset();
    mockAuthorizedFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keys every query separately, so two queries never share a cache entry (FR-013, SC-005)', async () => {
    const { discogsKeys } = await import('../../../src/queries/discogsQueries');

    expect(discogsKeys.suggest('miles')).not.toEqual(discogsKeys.suggest('davis'));
  });

  it('useCatalogSuggestions stays disabled while the caller gates it off (FR-004, research D10)', async () => {
    const { useCatalogSuggestions } = await import('../../../src/queries/discogsQueries');
    const { result } = renderHook(() => useCatalogSuggestions('miles davis', false), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockSuggest).not.toHaveBeenCalled();
  });

  it('useCatalogSuggestions serves a repeated query from its five-minute window instead of asking again (FR-017)', async () => {
    mockSuggest.mockResolvedValue([]);

    // This client has no `staleTime` default, so a remount refetches unless
    // the hook itself sets `staleTime: 5 * 60_000`.
    const client = createTestQueryClient();
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { useCatalogSuggestions } = await import('../../../src/queries/discogsQueries');
    const first = renderHook(() => useCatalogSuggestions('miles davis', true), {
      wrapper: localWrapper,
    });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useCatalogSuggestions('miles davis', true), {
      wrapper: localWrapper,
    });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(mockSuggest).toHaveBeenCalledTimes(1);
  });

  it('useCatalogSuggestions surfaces a failure immediately instead of retrying (FR-019, research D8)', async () => {
    mockSuggest.mockRejectedValue(new Error('suggest upstream down'));

    // Retries are on by default here, so a single call proves the hook opted
    // out with `retry: false` rather than inheriting the client's default.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 3, retryDelay: 1, gcTime: Infinity } },
    });
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { useCatalogSuggestions } = await import('../../../src/queries/discogsQueries');
    const { result } = renderHook(() => useCatalogSuggestions('miles davis', true), {
      wrapper: localWrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockSuggest).toHaveBeenCalledTimes(1);
  });

  it("asks Vinylmania's own backend for suggestions through authorizedFetch, and nothing else (Principle IX, FR-016)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    mockAuthorizedFetch.mockResolvedValue({ json: async () => ({ suggestions: [] }) });

    const discogsApi = await vi.importActual<
      typeof import('../../../src/services/discogsApi')
    >('../../../src/services/discogsApi');
    await discogsApi.suggest('miles davis');

    expect(mockAuthorizedFetch).toHaveBeenCalledWith(
      '/api/discogs/suggest?q=miles+davis',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

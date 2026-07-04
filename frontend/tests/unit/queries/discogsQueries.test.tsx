import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../testUtils';

const mockSearch = vi.fn();
const mockGetRelease = vi.fn();

vi.mock('../../../src/services/discogsApi', () => ({
  search: (...args: unknown[]) => mockSearch(...args),
  getRelease: (...args: unknown[]) => mockGetRelease(...args),
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

  it('useCatalogSearch stays disabled and issues no request for an empty query', async () => {
    const { useCatalogSearch } = await import('../../../src/queries/discogsQueries');
    const { result } = renderHook(() => useCatalogSearch('', 'release'), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('useCatalogSearch fetches results for a non-empty query', async () => {
    mockSearch.mockResolvedValue({ results: [], pagination: { page: 1, pages: 0, items: 0, perPage: 50 } });

    const { useCatalogSearch } = await import('../../../src/queries/discogsQueries');
    const { result } = renderHook(() => useCatalogSearch('aphex twin', 'release', 1, 50), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSearch).toHaveBeenCalledWith('aphex twin', 'release', 1, 50);
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

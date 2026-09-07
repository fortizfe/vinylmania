import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../testUtils';

const mockGetStreamingLinks = vi.fn();

vi.mock('../../../src/services/streamingApi', () => ({
  getStreamingLinks: (...args: unknown[]) => mockGetStreamingLinks(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('streamingQueries — useStreamingLinks (feature 062)', () => {
  beforeEach(() => {
    mockGetStreamingLinks.mockReset();
  });

  it('stays disabled and issues no request when artist or title is missing', async () => {
    const { useStreamingLinks } = await import('../../../src/queries/streamingQueries');

    const { result } = renderHook(
      () => useStreamingLinks({ barcodes: ['123'], title: 'Only Title' }),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetStreamingLinks).not.toHaveBeenCalled();
  });

  it('fetches with barcodes + artist + title + navigator.language when artist and title are present', async () => {
    mockGetStreamingLinks.mockResolvedValue({ links: [] });

    const { useStreamingLinks } = await import('../../../src/queries/streamingQueries');
    const { result } = renderHook(
      () =>
        useStreamingLinks({
          barcodes: ['075596060721'],
          artist: 'Metallica',
          title: 'Master of Puppets',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetStreamingLinks).toHaveBeenCalledWith({
      barcodes: ['075596060721'],
      artist: 'Metallica',
      title: 'Master of Puppets',
      locale: navigator.language,
    });
  });

  it('keys equal regardless of the incoming barcode order (normalised/sorted)', async () => {
    const { streamingKeys } = await import('../../../src/queries/streamingQueries');

    expect(streamingKeys.links(['b', 'a', 'c'], 'Artist', 'Title', 'es-ES')).toEqual(
      streamingKeys.links(['a', 'b', 'c'], 'Artist', 'Title', 'es-ES'),
    );
    expect(streamingKeys.links(['a'], 'Artist', 'Title', 'es-ES')).not.toEqual(
      streamingKeys.links(['a'], 'Artist', 'Other', 'es-ES'),
    );
  });

  it('serves a second render from cache without refetching (session-long staleTime)', async () => {
    mockGetStreamingLinks.mockResolvedValue({ links: [] });

    const client = createTestQueryClient();
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { useStreamingLinks } = await import('../../../src/queries/streamingQueries');
    const input = { barcodes: ['1'], artist: 'A', title: 'T' };

    const first = renderHook(() => useStreamingLinks(input), { wrapper: localWrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

    const second = renderHook(() => useStreamingLinks(input), { wrapper: localWrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(mockGetStreamingLinks).toHaveBeenCalledTimes(1);
  });
});

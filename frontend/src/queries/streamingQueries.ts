import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import * as streamingApi from '../services/streamingApi';
import type { StreamingLinksResponse } from '../services/streamingApi';

/** Barcodes are content, not order-significant — sort a copy so a differently
 *  ordered identifier list from the release vs. the master page keys the same. */
function normalizeBarcodes(barcodes: string[]): string[] {
  return [...barcodes].sort();
}

export const streamingKeys = {
  all: ['streaming'] as const,
  links: (barcodes: string[], artist: string, title: string, locale: string) =>
    [
      ...streamingKeys.all,
      'links',
      normalizeBarcodes(barcodes),
      artist,
      title,
      locale,
    ] as const,
};

/**
 * Resolves the streaming-platform links for one record against the viewer's
 * locale-derived storefront (feature 062). Mirrors the `discogsQueries`
 * conventions: content-derived key, `enabled` guard, no error retry storm.
 *
 * `staleTime` is `Infinity` — within a session the result never goes stale
 * client-side; the 90-day authority is the server cache.
 */
export function useStreamingLinks({
  barcodes,
  artist,
  title,
}: {
  barcodes: string[];
  artist?: string;
  title?: string;
}): UseQueryResult<StreamingLinksResponse> {
  const locale = navigator.language;
  return useQuery({
    queryKey: streamingKeys.links(barcodes, artist ?? '', title ?? '', locale),
    queryFn: () =>
      streamingApi.getStreamingLinks({
        barcodes,
        artist: artist ?? '',
        title: title ?? '',
        locale,
      }),
    enabled: Boolean(artist && title),
    staleTime: Infinity,
    retry: 1,
  });
}

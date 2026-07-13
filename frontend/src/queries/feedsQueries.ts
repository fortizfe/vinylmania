import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import * as feedsApi from '../services/feedsApi';
import type { DashboardResponse, SourceFeedResponse } from '../services/feedsApi';

export const feedsKeys = {
  all: ['feeds'] as const,
  dashboard: () => [...feedsKeys.all, 'dashboard'] as const,
  source: (sourceId: string) => [...feedsKeys.all, 'source', sourceId] as const,
};

export function useDashboardFeeds(): UseQueryResult<DashboardResponse> {
  return useQuery({
    queryKey: feedsKeys.dashboard(),
    queryFn: () => feedsApi.getDashboard(),
  });
}

/** Queries one source's feed directly — enabled only once a source is selected (spec 041 FR-008). */
export function useSourceFeed(sourceId: string | null): UseQueryResult<SourceFeedResponse> {
  return useQuery({
    queryKey: feedsKeys.source(sourceId ?? ''),
    queryFn: () => feedsApi.getSourceFeed(sourceId as string),
    enabled: sourceId !== null,
  });
}

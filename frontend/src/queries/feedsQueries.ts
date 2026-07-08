import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import * as feedsApi from '../services/feedsApi';
import type { DashboardResponse } from '../services/feedsApi';

export const feedsKeys = {
  all: ['feeds'] as const,
  dashboard: () => [...feedsKeys.all, 'dashboard'] as const,
};

export function useDashboardFeeds(): UseQueryResult<DashboardResponse> {
  return useQuery({
    queryKey: feedsKeys.dashboard(),
    queryFn: () => feedsApi.getDashboard(),
  });
}

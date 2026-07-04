import { QueryClient } from '@tanstack/react-query';

// Catalog/library reads change infrequently enough that a multi-minute
// staleTime avoids redundant refetches on remount while still refreshing
// in the background per TanStack Query's default refetchOnWindowFocus.
const DEFAULT_STALE_TIME_MS = 5 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME_MS,
    },
  },
});

import type { SourceStatus } from '../services/feedsApi';

interface FeedSourceStatusBannerProps {
  sourceStatuses: SourceStatus[];
}

export function FeedSourceStatusBanner({ sourceStatuses }: FeedSourceStatusBannerProps) {
  const unavailable = sourceStatuses.filter((source) => source.status === 'unavailable');

  if (unavailable.length === 0) {
    return null;
  }

  const names = unavailable.map((source) => source.sourceName).join(', ');

  return (
    <p
      role="status"
      className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      {names} {unavailable.length === 1 ? 'is' : 'are'} temporarily unavailable — showing the rest of the news for now.
    </p>
  );
}

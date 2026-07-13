import clsx from 'clsx';

import type { SourceStatus } from '../services/feedsApi';

interface FeedSourceFilterBarProps {
  sourceStatuses: SourceStatus[];
  selectedSource: string | null;
  onSelectSource: (sourceId: string | null) => void;
}

const baseButtonClassName =
  'flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 py-1 text-sm font-medium transition-colors';
const activeClassName = 'bg-primary text-white';
const inactiveClassName =
  'bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800';

export function FeedSourceFilterBar({
  sourceStatuses,
  selectedSource,
  onSelectSource,
}: FeedSourceFilterBarProps) {
  // Stable sort: priority sources first, each group preserving array order (spec FR-012).
  const orderedSources = [...sourceStatuses].sort((a, b) => {
    if (a.priority === b.priority) {
      return 0;
    }
    return a.priority ? -1 : 1;
  });

  return (
    <div role="group" aria-label="Filter by source" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={selectedSource === null}
        onClick={() => onSelectSource(null)}
        className={clsx(
          baseButtonClassName,
          selectedSource === null ? activeClassName : inactiveClassName,
        )}
      >
        All sources
      </button>
      {orderedSources.map((source) => (
        <button
          key={source.sourceId}
          type="button"
          aria-pressed={selectedSource === source.sourceId}
          onClick={() => onSelectSource(source.sourceId)}
          className={clsx(
            baseButtonClassName,
            selectedSource === source.sourceId ? activeClassName : inactiveClassName,
          )}
        >
          {source.sourceName}
        </button>
      ))}
    </div>
  );
}

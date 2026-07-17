import { Link } from 'react-router-dom';

import { presentRating } from '../lib/releaseRating';
import type { CatalogSearchResult } from '../services/discogsApi';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { ReleaseRatingBadge } from './ui/ReleaseRatingBadge';
import { ResultCardActions } from './ResultCardActions';

interface SearchResultListRowProps {
  result: CatalogSearchResult;
  /** Current search results URL, carried as router state so the detail page's back action returns here. */
  searchPath: string;
  onAdd: () => void;
  adding: boolean;
  added: boolean;
}

export function SearchResultListRow({
  result,
  searchPath,
  onAdd,
  adding,
  added,
}: SearchResultListRowProps) {
  const isGrouped = result.resultType === 'master';
  const formats = result.formats?.join(', ');
  const labels = result.labels?.join(', ');
  const rating = presentRating(result.communityRating);
  const detailPath = isGrouped
    ? `/app/masters/${result.discogsId}`
    : `/app/releases/${result.discogsId}`;

  const thumbnail = (
    <div className="relative shrink-0">
      {isGrouped && (
        <div
          data-testid="search-result-stacked-covers"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-6 rounded-md border border-stone-200 bg-stone-100 shadow-md dark:border-stone-800 dark:bg-stone-900" />
          <div className="absolute inset-0 translate-x-1 translate-y-1 -rotate-3 rounded-md border border-stone-200 bg-stone-50 shadow-sm dark:border-stone-800 dark:bg-stone-950" />
        </div>
      )}
      {result.thumbnailUrl ? (
        <img
          src={result.thumbnailUrl}
          alt={result.title}
          className="relative h-16 w-16 rounded-md object-cover sm:h-20 sm:w-20"
        />
      ) : (
        <div
          data-testid="search-result-thumbnail-placeholder"
          className="relative h-16 w-16 rounded-md bg-stone-100 dark:bg-stone-900 sm:h-20 sm:w-20"
        />
      )}
      {!isGrouped && (
        <div className="absolute -top-1.5 -right-1.5">
          <ReleaseRatingBadge displayValue={rating.displayValue} band={rating.band} />
        </div>
      )}
    </div>
  );

  return (
    <li>
      <Card padding="sm">
        <div className="flex items-center gap-4">
          <Link
            to={detailPath}
            state={{ from: searchPath }}
            className="flex items-center gap-4"
          >
            {thumbnail}
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate font-semibold text-stone-900 dark:text-stone-100">
                {result.title}
              </span>
              {result.artist && (
                <span className="truncate text-sm text-stone-500 dark:text-stone-400">
                  {result.artist}
                </span>
              )}
              {!isGrouped && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500 dark:text-stone-400">
                  {formats && <span className="truncate">{formats}</span>}
                  {result.country && <span>{result.country}</span>}
                  {result.year && <span>{result.year}</span>}
                  {labels && <span className="truncate">{labels}</span>}
                </div>
              )}
            </div>
          </Link>
          {isGrouped ? (
            <Badge tone="muted">Multiple editions</Badge>
          ) : (
            <ResultCardActions onAdd={onAdd} adding={adding} added={added} />
          )}
        </div>
      </Card>
    </li>
  );
}

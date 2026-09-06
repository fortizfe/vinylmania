import { Link } from 'react-router-dom';
import clsx from 'clsx';

import { presentRating } from '../lib/releaseRating';
import type { CatalogSearchResult } from '../services/discogsApi';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { ReleaseRatingBadge } from './ui/ReleaseRatingBadge';
import { ResultCardActions } from './ResultCardActions';
import { pressableCard } from './ui/press';

interface SearchResultCardProps {
  result: CatalogSearchResult;
  /** Current search results URL, carried as router state so the detail page's back action returns here (spec FR-012). */
  searchPath: string;
  onAdd: () => void;
  adding: boolean;
  added: boolean;
  onAddToWantlist: () => void;
  addingToWantlist: boolean;
  inWantlist: boolean;
  /**
   * Post-add note shown under the actions — e.g. "already in your library"
   * after a successful wishlist add (feature 060, FR-007a). `null` = none.
   */
  wantlistNote?: string | null;
}

export function SearchResultCard({
  result,
  searchPath,
  onAdd,
  adding,
  added,
  onAddToWantlist,
  addingToWantlist,
  inWantlist,
  wantlistNote = null,
}: SearchResultCardProps) {
  const format = result.formats?.[0];
  const rating = presentRating(result.communityRating);
  const isGrouped = result.resultType === 'master';

  const visual = (
    <>
      <div className="relative">
        {isGrouped && (
          <div
            data-testid="search-result-stacked-covers"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-6 rounded-md border border-stone-200 bg-stone-100 shadow-md dark:border-stone-800 dark:bg-stone-900" />
            <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 -rotate-3 rounded-md border border-stone-200 bg-stone-50 shadow-sm dark:border-stone-800 dark:bg-stone-950" />
          </div>
        )}
        {result.thumbnailUrl ? (
          <img
            src={result.thumbnailUrl}
            alt={result.title}
            className="relative aspect-square w-full rounded-md object-cover"
          />
        ) : (
          <div
            data-testid="search-result-thumbnail-placeholder"
            className="relative aspect-square w-full rounded-md bg-stone-100 dark:bg-stone-900"
          />
        )}
        <div className="absolute top-2 right-2">
          <ReleaseRatingBadge displayValue={rating.displayValue} band={rating.band} />
        </div>
      </div>
      <span className="truncate font-semibold text-stone-900 dark:text-stone-100">
        {result.title}
      </span>
      {result.artist && (
        <span className="truncate text-sm text-stone-500 dark:text-stone-400">
          {result.artist}
        </span>
      )}
      <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
        {result.year && <span>{result.year}</span>}
        {!isGrouped && format && <Badge tone="muted">{format}</Badge>}
      </div>
    </>
  );

  const detailPath = isGrouped
    ? `/app/masters/${result.discogsId}`
    : `/app/releases/${result.discogsId}`;

  return (
    <Card padding="sm" className="flex flex-col gap-2 sm:h-96">
      <Link
        to={detailPath}
        state={{ from: searchPath }}
        className={clsx('flex flex-col gap-2', pressableCard)}
      >
        {visual}
      </Link>
      {isGrouped ? (
        <Badge tone="muted">Multiple editions</Badge>
      ) : (
        <>
          <ResultCardActions
            onAdd={onAdd}
            adding={adding}
            added={added}
            onAddToWantlist={onAddToWantlist}
            addingToWantlist={addingToWantlist}
            inWantlist={inWantlist}
          />
          {wantlistNote && (
            <p role="status" className="text-xs text-stone-500 dark:text-stone-400">
              {wantlistNote}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

import { useId } from 'react';

import type { ArtistCount } from '../../services/collectionStatsApi';
import { Card } from '../ui/Card';

interface TopArtistsListProps {
  artists: ArtistCount[];
  mostPresent: ArtistCount | null;
}

const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value);
const records = (value: number) => (value === 1 ? 'record' : 'records');

/**
 * The most-present artist, called out above the ranked list. The call-out is
 * marked with a text label ("Most present") and the rank list is numbered —
 * status is never carried by colour alone (Principle X, FR-009).
 */
export function TopArtistsList({ artists, mostPresent }: TopArtistsListProps) {
  const headingId = useId();

  return (
    <Card className="flex flex-col gap-3">
      <h3
        id={headingId}
        className="text-base font-semibold text-stone-900 dark:text-stone-100"
      >
        Top artists
      </h3>

      {artists.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          No artist data yet — sync your collection to populate this.
        </p>
      ) : (
        <>
          {mostPresent && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-stone-100 p-3 dark:bg-stone-900">
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                Most present
              </span>
              <span className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                {mostPresent.name}
              </span>
              <span className="text-sm text-stone-500 tabular-nums dark:text-stone-400">
                on {formatCount(mostPresent.count)} {records(mostPresent.count)}
              </span>
            </div>
          )}

          <ol aria-labelledby={headingId} className="flex list-none flex-col gap-1 p-0">
            {artists.map((artist, index) => (
              <li
                key={artist.name}
                className="flex items-center gap-3 border-b border-stone-200 py-1.5 last:border-b-0 dark:border-stone-800"
              >
                <span className="w-6 shrink-0 text-right text-sm font-medium tabular-nums text-stone-500 dark:text-stone-400">
                  {index + 1}
                </span>
                <span className="flex-1 truncate text-sm text-stone-900 dark:text-stone-100">
                  {artist.name}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-stone-900 dark:text-stone-100">
                  {formatCount(artist.count)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}

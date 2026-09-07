import type { ArtistCount } from '../../services/collectionStatsApi';
import { Card } from '../ui/Card';

interface CollectionTotalsProps {
  totalRecords: number;
  mostPresentArtist: ArtistCount | null;
}

const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value);

/**
 * The headline figures for Block 1: how many records the collection holds and,
 * when there is one, the artist that appears on the most of them. Both numbers
 * are shown as text — never conveyed by colour or size alone (Principle X).
 */
export function CollectionTotals({
  totalRecords,
  mostPresentArtist,
}: CollectionTotalsProps) {
  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-stone-500 dark:text-stone-400">
          Records in your collection
        </span>
        <span className="font-display text-4xl leading-display tracking-display text-stone-900 tabular-nums dark:text-stone-100">
          {formatCount(totalRecords)}
        </span>
      </div>

      {mostPresentArtist && (
        <div className="flex flex-col gap-1 sm:items-end">
          <span className="text-sm font-medium text-stone-500 dark:text-stone-400">
            Most-present artist
          </span>
          <span className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {mostPresentArtist.name}
          </span>
          <span className="text-sm text-stone-500 tabular-nums dark:text-stone-400">
            on {formatCount(mostPresentArtist.count)}{' '}
            {mostPresentArtist.count === 1 ? 'record' : 'records'}
          </span>
        </div>
      )}
    </Card>
  );
}

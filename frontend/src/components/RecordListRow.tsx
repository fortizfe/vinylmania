import { Link } from 'react-router-dom';

import { presentRating } from '../lib/releaseRating';
import type { EnrichedLibraryEntry } from '../services/libraryApi';
import { Card } from './ui/Card';
import { ReleaseRatingBadge } from './ui/ReleaseRatingBadge';

interface RecordListRowProps {
  entry: EnrichedLibraryEntry;
}

export function RecordListRow({ entry }: RecordListRowProps) {
  if (entry.catalogStatus === 'unavailable' || !entry.release) {
    return (
      <li>
        <Card
          padding="sm"
          className="flex flex-col gap-1 text-stone-500 italic dark:text-stone-400"
        >
          <p>Couldn&apos;t load catalog details for this record right now.</p>
          <Link to={`/app/library/records/${entry.id}`} className="text-sm underline">
            Open record
          </Link>
        </Card>
      </li>
    );
  }

  const { release } = entry;
  const artists = release.artists.map((artist) => artist.name).join(', ');
  const formats = release.formats.map((format) => format.name).join(', ');
  const labels = release.labels.map((label) => label.name).join(', ');
  const cover = release.images[0]?.url;
  const rating = presentRating(release.community?.rating);

  return (
    <li>
      <Card padding="sm">
        <Link to={`/app/library/records/${entry.id}`} className="flex items-center gap-4">
          <div className="relative shrink-0">
            {cover ? (
              <img
                src={cover}
                alt={release.title}
                className="h-16 w-16 rounded-md object-cover sm:h-20 sm:w-20"
              />
            ) : (
              <div
                data-testid="record-list-row-thumbnail-placeholder"
                className="h-16 w-16 rounded-md bg-stone-100 dark:bg-stone-900 sm:h-20 sm:w-20"
              />
            )}
            <div className="absolute -top-1.5 -right-1.5">
              <ReleaseRatingBadge displayValue={rating.displayValue} band={rating.band} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-semibold text-stone-900 dark:text-stone-100">
              {release.title}
            </span>
            {artists && (
              <span className="truncate text-sm text-stone-500 dark:text-stone-400">
                {artists}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500 dark:text-stone-400">
              {formats && <span className="truncate">{formats}</span>}
              {release.country && <span>{release.country}</span>}
              {release.year && <span>{release.year}</span>}
              {labels && <span className="truncate">{labels}</span>}
            </div>
          </div>
        </Link>
      </Card>
    </li>
  );
}

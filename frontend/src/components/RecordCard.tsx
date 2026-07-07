import { Link } from 'react-router-dom';

import { presentRating } from '../lib/releaseRating';
import type { EnrichedLibraryEntry } from '../services/libraryApi';
import { Card } from './ui/Card';
import { ReleaseRatingBadge } from './ui/ReleaseRatingBadge';

interface RecordCardProps {
  entry: EnrichedLibraryEntry;
}

export function RecordCard({ entry }: RecordCardProps) {
  if (entry.catalogStatus === 'unavailable' || !entry.release) {
    return (
      <li>
        <Card padding="sm" className="flex flex-col gap-1 text-gray-500 italic dark:text-gray-400">
          <p>Couldn&apos;t load catalog details for this record right now.</p>
          <Link to={`/app/library/records/${entry.id}`} className="text-sm underline">
            Open record
          </Link>
        </Card>
      </li>
    );
  }

  const { release } = entry;
  const primaryArtist = release.artists[0]?.name;
  const cover = release.images[0]?.url;
  const rating = presentRating(release.community?.rating);

  return (
    <li>
      <Card padding="sm" className="flex flex-col gap-2">
        <Link to={`/app/library/records/${entry.id}`} className="flex flex-col gap-2">
          <div className="relative">
            {cover ? (
              <img src={cover} alt="" className="aspect-square w-full rounded-md object-cover" />
            ) : (
              <div className="aspect-square w-full rounded-md bg-gray-100 dark:bg-gray-800" />
            )}
            <div className="absolute top-2 right-2">
              <ReleaseRatingBadge displayValue={rating.displayValue} band={rating.band} />
            </div>
          </div>
          <span className="truncate font-semibold text-gray-900 dark:text-gray-100">
            {release.title}
          </span>
          {primaryArtist && (
            <span className="truncate text-sm text-gray-500 dark:text-gray-400">
              {primaryArtist}
            </span>
          )}
        </Link>
      </Card>
    </li>
  );
}

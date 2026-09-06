import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

import { presentRating } from '../lib/releaseRating';
import { useRemoveFromWantlist } from '../queries/wantlistQueries';
import type { EnrichedWantEntry } from '../services/wantlistApi';
import { RemoveFromWantlistDialog } from './RemoveFromWantlistDialog';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { TrashIcon } from './ui/icons/TrashIcon';
import { pressableCard } from './ui/press';
import { ReleaseRatingBadge } from './ui/ReleaseRatingBadge';

interface WantlistCardProps {
  entry: EnrichedWantEntry;
}

/** The wishlist path, carried as router state so the release detail page can offer an accurate "back". */
const FROM_WISHLIST = { from: '/app/wishlist' } as const;

/** Shown in the confirm dialog when the catalog title could not be loaded. */
const GENERIC_TITLE = 'this record';

export function WantlistCard({ entry }: WantlistCardProps) {
  const detailPath = `/app/releases/${entry.discogsReleaseId}`;
  const [dialogOpen, setDialogOpen] = useState(false);
  const removeFromWantlist = useRemoveFromWantlist();

  // FR-011: the remove action lives IN the wishlist view. `discogsReleaseId`
  // is always present (even on an `unavailable` fallback card), so the entry
  // stays removable regardless of catalog health.
  function confirmRemove() {
    removeFromWantlist.mutate(entry.discogsReleaseId, {
      // On success the list refetches via the `wantlistKeys.all` invalidation
      // in `useRemoveFromWantlist` — this card simply unmounts. On error the
      // dialog stays open and surfaces `removeFromWantlist.isError`.
      onSuccess: () => setDialogOpen(false),
    });
  }

  const removeControl = (
    <>
      <div className="flex justify-end">
        <Button
          size="icon"
          variant="secondary"
          aria-label="Remove from wishlist"
          onClick={() => setDialogOpen(true)}
        >
          <TrashIcon />
        </Button>
      </div>
      <RemoveFromWantlistDialog
        open={dialogOpen}
        releaseTitle={entry.release?.title ?? GENERIC_TITLE}
        removing={removeFromWantlist.isPending}
        error={removeFromWantlist.isError}
        onConfirm={confirmRemove}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );

  if (entry.catalogStatus === 'unavailable' || !entry.release) {
    return (
      <li>
        <Card padding="sm" className="flex flex-col gap-2">
          <div className="flex flex-col gap-1 text-stone-500 italic dark:text-stone-400">
            <p>Couldn&apos;t load catalog details for this record right now.</p>
            <Link
              to={detailPath}
              state={FROM_WISHLIST}
              className="text-sm font-medium text-primary not-italic dark:text-primary-text"
            >
              Open release
            </Link>
          </div>
          {removeControl}
        </Card>
      </li>
    );
  }

  const { release } = entry;
  const primaryArtist = release.artists[0]?.name;
  const cover = release.images[0]?.url;
  // FR-003: the badge always shows the Discogs *community* rating for the
  // release — never the personal per-entry `entry.rating` (that lives in the
  // detail-page wishlist panel, US3).
  const rating = presentRating(release.community?.rating);

  return (
    <li>
      <Card padding="sm" className="flex flex-col gap-2">
        <Link
          to={detailPath}
          state={FROM_WISHLIST}
          className={clsx('flex flex-col gap-2', pressableCard)}
        >
          <div className="relative">
            {cover ? (
              <img
                src={cover}
                alt=""
                className="aspect-square w-full rounded-md object-cover"
              />
            ) : (
              <div className="aspect-square w-full rounded-md bg-stone-100 dark:bg-stone-900" />
            )}
            <div className="absolute top-2 right-2">
              <ReleaseRatingBadge displayValue={rating.displayValue} band={rating.band} />
            </div>
          </div>
          <span className="truncate font-semibold text-stone-900 dark:text-stone-100">
            {release.title}
          </span>
          {primaryArtist && (
            <span className="truncate text-sm text-stone-500 dark:text-stone-400">
              {primaryArtist}
            </span>
          )}
        </Link>
        {removeControl}
      </Card>
    </li>
  );
}

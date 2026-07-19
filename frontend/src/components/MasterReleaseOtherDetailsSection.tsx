import { Badge } from './ui/Badge';
import type { MasterRelease } from '../services/discogsApi';

interface MasterReleaseOtherDetailsSectionProps {
  master: MasterRelease;
}

/** Whether the master has any year/genre/style data to show (spec 057 FR-007) — governs whether the page renders this card at all. */
export function masterHasOtherDetails(master: MasterRelease): boolean {
  return Boolean(master.year) || master.genres.length > 0 || master.styles.length > 0;
}

/**
 * Master's year/genres/styles plus a "View on Discogs" link (spec 057
 * Clarification Q3), using the same external-link convention as
 * `FeedArticleCard.tsx` (`target="_blank"`, `rel="noopener noreferrer"`).
 */
export function MasterReleaseOtherDetailsSection({
  master,
}: MasterReleaseOtherDetailsSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
        {master.year && <span>{master.year}</span>}
        {master.genres.map((genre) => (
          <Badge key={genre}>{genre}</Badge>
        ))}
        {master.styles.map((style) => (
          <Badge key={style} tone="muted">
            {style}
          </Badge>
        ))}
      </div>
      <a
        href={master.discogsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-primary no-underline hover:underline"
      >
        View on Discogs
      </a>
    </div>
  );
}

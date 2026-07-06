import clsx from 'clsx';

import type { RatingBand } from '../../lib/releaseRating';

interface ReleaseRatingBadgeProps {
  displayValue: string;
  band: RatingBand;
}

const BACKGROUND_CLASSES: Record<RatingBand, string> = {
  low: 'bg-rating-low',
  medium: 'bg-rating-medium',
  high: 'bg-rating-high',
};

// Text color per band chosen alongside the background tokens in
// research.md §8 to meet WCAG AA contrast (FR-013).
const TEXT_CLASSES: Record<RatingBand, string> = {
  low: 'text-white',
  medium: 'text-gray-900',
  high: 'text-white',
};

export function ReleaseRatingBadge({ displayValue, band }: ReleaseRatingBadgeProps) {
  return (
    <span
      role="status"
      aria-label={`Rating ${displayValue} out of 5`}
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold shadow-sm',
        BACKGROUND_CLASSES[band],
        TEXT_CLASSES[band],
      )}
    >
      {displayValue}
    </span>
  );
}

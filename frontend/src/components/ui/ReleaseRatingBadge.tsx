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
  // Unrated/error placeholder (feature 019): adapts per theme, unlike the
  // fixed-color bands above — see research.md §2. `border-stone-500` added
  // (spec 058 T027 finding #5): this fill barely differs from the card
  // surfaces it sits on (~1.41:1 light / ~1.75:1 dark against
  // bg-stone-50/dark:bg-surface-raised), under the WCAG AA 3:1 minimum for
  // UI component boundaries (1.4.11). A border (not a darker/lighter fill)
  // is the fix here specifically so the already-AA-compliant fill/text
  // pairing (research.md §2) stays untouched — border-stone-500 measures
  // ~4.59:1 (light) / ~3.75:1 (dark) against those same card surfaces.
  unrated: 'border border-stone-500 bg-rating-unrated dark:bg-stone-700',
};

// Text color per band chosen alongside the background tokens in
// research.md §8 to meet WCAG AA contrast (FR-013); the unrated pairing is
// chosen in research.md §2 to meet the same bar (spec FR-005).
const TEXT_CLASSES: Record<RatingBand, string> = {
  low: 'text-white',
  medium: 'text-stone-900',
  high: 'text-white',
  unrated: 'text-stone-700 dark:text-stone-100',
};

// Distinct accessible label for the unrated/error placeholder (spec FR-006) —
// the numeric "Rating X out of 5" phrasing would be confusing read aloud as
// "Rating - out of 5".
function accessibleLabel(band: RatingBand, displayValue: string): string {
  if (band === 'unrated') return 'Rating not available';
  return `Rating ${displayValue} out of 5`;
}

export function ReleaseRatingBadge({ displayValue, band }: ReleaseRatingBadgeProps) {
  return (
    <span
      role="status"
      aria-label={accessibleLabel(band, displayValue)}
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

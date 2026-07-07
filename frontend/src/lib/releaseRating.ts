export type RatingBand = 'low' | 'medium' | 'high' | 'unrated';

export interface RatingSource {
  average: number;
  count: number;
}

export interface RatingPresentation {
  displayValue: string;
  band: RatingBand;
}

// Inclusive band boundaries per spec FR-005/FR-006/FR-007.
const LOW_BAND_MAX = 2.5;
const MEDIUM_BAND_MAX = 4.09;

/** FR-008: a rating is only shown when it is a real, votable, in-range value. */
export function isRatingVisible(
  rating: RatingSource | null | undefined,
): rating is RatingSource {
  if (!rating) return false;
  const { average, count } = rating;
  if (!Number.isFinite(average) || !Number.isFinite(count)) return false;
  if (count <= 0) return false;
  if (average < 0 || average > 5) return false;
  return true;
}

export function bandForRating(average: number): RatingBand {
  if (average <= LOW_BAND_MAX) return 'low';
  if (average <= MEDIUM_BAND_MAX) return 'medium';
  return 'high';
}

/** Compact one-decimal label, e.g. 4.19 -> "4.2" (research.md §5). */
export function formatRatingValue(average: number): string {
  return average.toFixed(1);
}

/**
 * Always derives a badge presentation (spec FR-001/FR-002): a valid rating
 * gets its numeric value and color band, otherwise the badge gets the
 * "unrated" placeholder (dash on soft gray) instead of being omitted.
 */
export function presentRating(rating: RatingSource | null | undefined): RatingPresentation {
  if (!isRatingVisible(rating)) return { displayValue: '-', band: 'unrated' };
  return {
    displayValue: formatRatingValue(rating.average),
    band: bandForRating(rating.average),
  };
}

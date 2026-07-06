export type RatingBand = 'low' | 'medium' | 'high';

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

/** Derives the badge's presentation, or null when the badge must be omitted. */
export function presentRating(rating: RatingSource | null | undefined): RatingPresentation | null {
  if (!isRatingVisible(rating)) return null;
  return {
    displayValue: formatRatingValue(rating.average),
    band: bandForRating(rating.average),
  };
}

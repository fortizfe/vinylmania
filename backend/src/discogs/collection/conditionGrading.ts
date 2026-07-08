/**
 * Discogs' closed grading vocabulary. The fields endpoint rejects dropdown
 * values that don't exactly match the field's option list, so both the API
 * validation and the frontend dropdowns must use these exact strings.
 */
export const MEDIA_CONDITIONS = [
  'Mint (M)',
  'Near Mint (NM or M-)',
  'Very Good Plus (VG+)',
  'Very Good (VG)',
  'Good Plus (G+)',
  'Good (G)',
  'Fair (F)',
  'Poor (P)',
] as const;

export const SLEEVE_CONDITIONS = [
  ...MEDIA_CONDITIONS,
  'Generic',
  'Not Graded',
  'No Cover',
] as const;

export type MediaCondition = (typeof MEDIA_CONDITIONS)[number];
export type SleeveCondition = (typeof SLEEVE_CONDITIONS)[number];

export function isMediaCondition(value: string): value is MediaCondition {
  return (MEDIA_CONDITIONS as readonly string[]).includes(value);
}

export function isSleeveCondition(value: string): value is SleeveCondition {
  return (SLEEVE_CONDITIONS as readonly string[]).includes(value);
}

// Vinylmania's pre-016 free-text options (see the old MyCopySection dropdown)
// mapped onto Discogs grading strings for the first-sync migration (FR-010).
const LEGACY_CONDITION_MAP: Record<string, MediaCondition> = {
  Mint: 'Mint (M)',
  'Near Mint': 'Near Mint (NM or M-)',
  'Very Good Plus': 'Very Good Plus (VG+)',
  Good: 'Good (G)',
  Fair: 'Fair (F)',
  Poor: 'Poor (P)',
};

/**
 * Maps a legacy stored condition to a Discogs media grading value, or null
 * when there is no equivalent — callers must then preserve the original text
 * (appended to the migrated notes) so no information is lost.
 */
export function mapLegacyCondition(value: string): MediaCondition | null {
  if (isMediaCondition(value)) {
    return value;
  }
  return LEGACY_CONDITION_MAP[value] ?? null;
}

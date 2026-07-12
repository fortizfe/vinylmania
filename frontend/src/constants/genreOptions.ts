/**
 * Fixed, curated list of Discogs genre names (spec FR-007, feature 038).
 * No Discogs endpoint enumerates valid genre values, so this list is
 * maintained statically. Declaration order is the canonical order used
 * everywhere a genre selection is serialized or rendered (URL params,
 * checkbox list, active-filter display).
 */

export const GENRE_OPTIONS: readonly string[] = [
  'Blues',
  'Brass & Military',
  'Children\'s',
  'Classical',
  'Electronic',
  'Folk, World, & Country',
  'Funk / Soul',
  'Hip Hop',
  'Jazz',
  'Latin',
  'Non-Music',
  'Pop',
  'Reggae',
  'Rock',
  'Stage & Screen',
];

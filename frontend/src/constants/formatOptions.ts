/**
 * Fixed, curated list of standard Discogs format names (spec FR-002, feature
 * 022). No Discogs endpoint enumerates valid format values, so this list is
 * maintained statically, consistent with feature 021's Genre/Style Assumption.
 * Declaration order is the canonical order used everywhere a format selection
 * is serialized or rendered (URL params, checkbox list, active-filter display).
 */
export const FORMAT_OPTIONS: readonly string[] = [
  'Vinyl',
  'CD',
  'Cassette',
  'CDr',
  'File',
  'DVD',
  'Box Set',
  '8-Track Cartridge',
  'Flexi-disc',
  'All Media',
  'VHS',
  'Reel-To-Reel',
  'DVDr',
  'Blu-ray',
  'Lathe Cut',
  'Shellac',
  'Laserdisc',
  'Acetate',
  'PlayTape',
  '4-Track Cartridge',
  'Blu-ray-R',
  'SACD',
  'Memory Stick',
  'Minidisc',
  'Betamax',
  'Betacam SP',
  'Floppy Disk',
  'Hybrid',
  'U-matic',
  'DCC',
  'HD DVD',
  'SelectaVision',
  'VHD',
];

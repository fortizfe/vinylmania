/// Discogs grading vocabulary, verbatim from frontend MyCopySection.tsx
/// (must match backend conditionGrading.ts exactly).
const mediaConditions = <String>[
  'Mint (M)',
  'Near Mint (NM or M-)',
  'Very Good Plus (VG+)',
  'Very Good (VG)',
  'Good Plus (G+)',
  'Good (G)',
  'Fair (F)',
  'Poor (P)',
];

const sleeveConditions = <String>[
  ...mediaConditions,
  'Generic',
  'Not Graded',
  'No Cover',
];

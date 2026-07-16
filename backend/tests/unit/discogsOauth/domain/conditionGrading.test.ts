import {
  MEDIA_CONDITIONS,
  SLEEVE_CONDITIONS,
  isMediaCondition,
  isSleeveCondition,
  mapLegacyCondition,
} from '../../../../src/domain/discogsOauth/conditionGrading';

describe('grading sets', () => {
  it('exposes the eight Discogs media grading values in grading order', () => {
    expect(MEDIA_CONDITIONS).toEqual([
      'Mint (M)',
      'Near Mint (NM or M-)',
      'Very Good Plus (VG+)',
      'Very Good (VG)',
      'Good Plus (G+)',
      'Good (G)',
      'Fair (F)',
      'Poor (P)',
    ]);
  });

  it('accepts the sleeve-only values for sleeve but not for media', () => {
    for (const value of ['Generic', 'Not Graded', 'No Cover']) {
      expect(isSleeveCondition(value)).toBe(true);
      expect(isMediaCondition(value)).toBe(false);
    }
    expect(SLEEVE_CONDITIONS).toEqual([
      ...MEDIA_CONDITIONS,
      'Generic',
      'Not Graded',
      'No Cover',
    ]);
  });

  it('accepts every media grading value for both media and sleeve', () => {
    for (const value of MEDIA_CONDITIONS) {
      expect(isMediaCondition(value)).toBe(true);
      expect(isSleeveCondition(value)).toBe(true);
    }
  });

  it('rejects values outside the grading sets', () => {
    expect(isMediaCondition('Near Mint')).toBe(false);
    expect(isMediaCondition('')).toBe(false);
    expect(isSleeveCondition('Shiny')).toBe(false);
  });
});

describe('mapLegacyCondition', () => {
  it.each([
    ['Mint', 'Mint (M)'],
    ['Near Mint', 'Near Mint (NM or M-)'],
    ['Very Good Plus', 'Very Good Plus (VG+)'],
    ['Good', 'Good (G)'],
    ['Fair', 'Fair (F)'],
    ['Poor', 'Poor (P)'],
  ])('maps the legacy UI value %s to %s', (legacy, expected) => {
    expect(mapLegacyCondition(legacy)).toBe(expected);
  });

  it('passes through values that are already exact Discogs grading strings', () => {
    expect(mapLegacyCondition('Very Good (VG)')).toBe('Very Good (VG)');
  });

  it('returns null for values with no Discogs grading equivalent', () => {
    expect(mapLegacyCondition('Sleeve torn but plays fine')).toBeNull();
    expect(mapLegacyCondition('')).toBeNull();
  });
});

import { matchesLibraryFilters } from '../../../../src/domain/library/libraryFilters';
import type { LibraryEntry } from '../../../../src/domain/library/types';

function entry(overrides: Partial<LibraryEntry>): LibraryEntry {
  return {
    id: 'e1',
    discogsReleaseId: 1,
    addedAt: '2026-07-03T00:00:00.000Z',
    ...overrides,
  };
}

describe('matchesLibraryFilters (feature 038, US2, FR-015/FR-017)', () => {
  it('matches everything when no filters are active', () => {
    expect(matchesLibraryFilters(entry({}), {})).toBe(true);
  });

  it('matches an entry whose genre includes the single selected value', () => {
    const e = entry({ genre: ['Rock', 'Pop'] });
    expect(matchesLibraryFilters(e, { genre: ['Rock'] })).toBe(true);
  });

  it('excludes an entry whose genre does not include the selected value', () => {
    const e = entry({ genre: ['Jazz'] });
    expect(matchesLibraryFilters(e, { genre: ['Rock'] })).toBe(false);
  });

  it('combines multiple selected values within one field with OR semantics', () => {
    const e = entry({ genre: ['Jazz'] });
    expect(matchesLibraryFilters(e, { genre: ['Rock', 'Jazz'] })).toBe(true);
  });

  it('combines active filters across different fields with AND semantics', () => {
    const e = entry({ genre: ['Rock'], style: ['Grunge'], format: ['Vinyl'] });
    expect(
      matchesLibraryFilters(e, { genre: ['Rock'], style: ['Grunge'], format: ['CD'] }),
    ).toBe(false);
    expect(
      matchesLibraryFilters(e, { genre: ['Rock'], style: ['Grunge'], format: ['Vinyl'] }),
    ).toBe(true);
  });

  it('never matches a filter on a field the entry has no stored values for (FR-024 edge case: never-enriched entry)', () => {
    const e = entry({});
    expect(matchesLibraryFilters(e, { genre: ['Rock'] })).toBe(false);
  });

  it('matches when only some fields have active filters, ignoring fields with no selection', () => {
    const e = entry({ genre: ['Rock'], style: ['Grunge'] });
    expect(matchesLibraryFilters(e, { genre: ['Rock'] })).toBe(true);
  });

  it('excludes an entry when an active style filter has no match, even if genre matches', () => {
    const e = entry({ genre: ['Rock'], style: ['Shoegaze'] });
    expect(matchesLibraryFilters(e, { genre: ['Rock'], style: ['Grunge'] })).toBe(false);
  });
});

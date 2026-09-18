import { describe, expect, it } from 'vitest';

import {
  readCatalogFilters,
  writeCatalogFilters,
} from '../../../src/hooks/catalogFilterParams';

describe('readCatalogFilters', () => {
  it('drops values that are not in the catalog', () => {
    expect(
      readCatalogFilters(new URLSearchParams('genre=Rock,Bogus&style=Punk')),
    ).toEqual({ genre: ['Rock'], style: ['Punk'] });
  });

  it('re-orders values to catalog order and ignores whitespace and empty entries', () => {
    expect(
      readCatalogFilters(
        new URLSearchParams('genre= Rock ,,Jazz, Blues&format=Vinyl,,CD'),
      ),
    ).toEqual({ genre: ['Blues', 'Jazz', 'Rock'], format: ['CD', 'Vinyl'] });
  });

  it('yields no key for an empty or absent param', () => {
    expect(readCatalogFilters(new URLSearchParams('genre=&style=Bogus'))).toEqual({});
    expect(readCatalogFilters(new URLSearchParams())).toEqual({});
  });
});

describe('writeCatalogFilters', () => {
  it('sets only non-empty filters', () => {
    const params = new URLSearchParams();
    writeCatalogFilters(params, { genre: [], format: ['Vinyl'] });
    expect(params.toString()).toBe('format=Vinyl');
  });

  it('comma-joins multiple values in catalog order', () => {
    const params = new URLSearchParams();
    writeCatalogFilters(params, { genre: ['Rock', 'Blues', 'Jazz'] });
    expect(params.get('genre')).toBe('Blues,Jazz,Rock');
  });

  it('leaves params untouched when no filters are given', () => {
    const params = new URLSearchParams('page=2');
    writeCatalogFilters(params);
    expect(params.toString()).toBe('page=2');
  });
});

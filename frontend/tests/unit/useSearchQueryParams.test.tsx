import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
  buildSearchPath,
  useSearchQueryParams,
} from '../../src/hooks/useSearchQueryParams';

function wrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe('useSearchQueryParams', () => {
  it('parses the query and page from the URL', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=miles+davis&page=3']),
    });

    expect(result.current).toEqual({ query: 'miles davis', page: 3 });
  });

  it('defaults page to 1 when absent', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=stockholm']),
    });

    expect(result.current).toEqual({ query: 'stockholm', page: 1 });
  });

  it('returns an empty query when there is no q param', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search']),
    });

    expect(result.current).toEqual({ query: '', page: 1 });
  });

  it('parses genre/style filters from the URL as arrays (feature 038)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&genre=Rock&style=Grunge']),
    });

    expect(result.current).toEqual({
      query: 'nirvana',
      page: 1,
      genre: ['Rock'],
      style: ['Grunge'],
    });
  });

  it('parses a comma-joined genre/style URL param into a string[] of recognized values, in canonical catalog order (feature 038)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&genre=Rock,Electronic&style=Shoegaze,Grunge']),
    });

    // "Rock,Electronic" in the URL, but GENRE_OPTIONS lists Electronic before Rock.
    expect(result.current.genre).toEqual(['Electronic', 'Rock']);
    // "Shoegaze,Grunge" in the URL, but STYLE_OPTIONS lists Grunge before Shoegaze.
    expect(result.current.style).toEqual(['Grunge', 'Shoegaze']);
  });

  it('drops genre/style values not present in their catalogs while keeping recognized ones (feature 038)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&genre=Rock,NotAGenre&style=Grunge,NotAStyle']),
    });

    expect(result.current.genre).toEqual(['Rock']);
    expect(result.current.style).toEqual(['Grunge']);
  });

  it('omits a filter entirely when its URL param is absent, blank, or has no recognized values (feature 038)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&genre=Rock&style=%20%20']),
    });

    expect(result.current).toEqual({ query: 'nirvana', page: 1, genre: ['Rock'] });
    expect(result.current.style).toBeUndefined();
  });

  it('parses a comma-joined format URL param into a string[] of recognized values, in canonical FORMAT_OPTIONS order (feature 022)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&format=Vinyl,CD']),
    });

    // "Vinyl,CD" in the URL, but FORMAT_OPTIONS (feature 038) lists CD before Vinyl.
    expect(result.current.format).toEqual(['CD', 'Vinyl']);
  });

  it('drops format values not present in FORMAT_OPTIONS while keeping recognized ones (FR-010, feature 022)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&format=Vinyl,NotARealFormat']),
    });

    expect(result.current.format).toEqual(['Vinyl']);
  });

  it('omits format entirely when no recognized values remain (feature 022)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&format=NotARealFormat']),
    });

    expect(result.current.format).toBeUndefined();
  });

  it('does not return an artist key even when an obsolete ?artist= param is present in the URL (FR-009, feature 022, US2)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&artist=Nirvana&genre=Rock']),
    });

    expect(result.current).toEqual({ query: 'nirvana', page: 1, genre: ['Rock'] });
    expect('artist' in result.current).toBe(false);
  });
});

describe('buildSearchPath', () => {
  it('builds a path with the trimmed, encoded query', () => {
    expect(buildSearchPath('  miles davis  ')).toBe('/app/search?q=miles+davis');
  });

  it('includes the page number when greater than 1', () => {
    expect(buildSearchPath('stockholm', 2)).toBe('/app/search?q=stockholm&page=2');
  });

  it('omits the page number when it is 1', () => {
    expect(buildSearchPath('stockholm', 1)).toBe('/app/search?q=stockholm');
  });

  it('encodes non-empty genre/style arrays and omits unset ones (feature 038)', () => {
    expect(
      buildSearchPath('stockholm', 1, { genre: ['Rock'], style: ['Grunge'] }),
    ).toBe('/app/search?q=stockholm&genre=Rock&style=Grunge');
  });

  it('joins a genre/style array into a single comma-separated param, in canonical catalog order (feature 038)', () => {
    expect(buildSearchPath('stockholm', 1, { genre: ['Rock', 'Electronic'] })).toBe(
      '/app/search?q=stockholm&genre=Electronic%2CRock',
    );
  });

  it('omits the genre/style params entirely when their arrays are empty (feature 038)', () => {
    expect(buildSearchPath('stockholm', 1, { genre: [], style: ['Grunge'] })).toBe(
      '/app/search?q=stockholm&style=Grunge',
    );
  });

  it('joins a format array into a single comma-separated param, in canonical FORMAT_OPTIONS order (feature 022)', () => {
    expect(buildSearchPath('stockholm', 1, { format: ['Vinyl', 'CD'] })).toBe(
      '/app/search?q=stockholm&format=CD%2CVinyl',
    );
  });

  it('omits the format param entirely when the array is empty (FR-005, feature 022)', () => {
    expect(buildSearchPath('stockholm', 1, { genre: ['Rock'], format: [] })).toBe(
      '/app/search?q=stockholm&genre=Rock',
    );
  });

  it('does not accept/encode an artist filter (FR-001, feature 022, US2)', () => {
    // @ts-expect-error artist is no longer part of SearchFilters (feature 022)
    expect(buildSearchPath('stockholm', 1, { artist: 'Nirvana', genre: ['Rock'] })).toBe(
      '/app/search?q=stockholm&genre=Rock',
    );
  });

  it('round-trips genre/style arrays through a built URL so a reload reproduces the identical filtered request (FR-007, Acceptance Scenario 3)', () => {
    const filters = { genre: ['Rock'], style: ['Grunge'] };
    const path = buildSearchPath('nevermind', 3, filters);

    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper([path]),
    });

    expect(result.current).toEqual({ query: 'nevermind', page: 3, ...filters });
  });

  it('round-trips a format selection through a built URL, reproducing the identical set of values (FR-007, SC-003, feature 022)', () => {
    const filters = { format: ['CD', 'Vinyl'] };
    const path = buildSearchPath('nevermind', 3, filters);

    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper([path]),
    });

    expect(result.current).toEqual({
      query: 'nevermind',
      page: 3,
      format: ['CD', 'Vinyl'],
    });
  });
});

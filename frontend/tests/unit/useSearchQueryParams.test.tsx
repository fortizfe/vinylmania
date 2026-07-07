import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { buildSearchPath, useSearchQueryParams } from '../../src/hooks/useSearchQueryParams';

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

  it('parses genre/style filters from the URL (feature 021)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&genre=Rock&style=Grunge']),
    });

    expect(result.current).toEqual({ query: 'nirvana', page: 1, genre: 'Rock', style: 'Grunge' });
  });

  it('omits a filter entirely when its URL param is absent or blank (feature 021)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&genre=Rock&style=%20%20']),
    });

    expect(result.current).toEqual({ query: 'nirvana', page: 1, genre: 'Rock' });
    expect(result.current.style).toBeUndefined();
  });

  it('parses a comma-joined format URL param into a string[] of recognized values, in canonical FORMAT_OPTIONS order (feature 022)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&format=CD,Vinyl']),
    });

    // "CD,Vinyl" in the URL, but FORMAT_OPTIONS lists Vinyl before CD.
    expect(result.current.format).toEqual(['Vinyl', 'CD']);
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

    expect(result.current).toEqual({ query: 'nirvana', page: 1, genre: 'Rock' });
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

  it('encodes non-empty text filters and omits unset ones (feature 021)', () => {
    expect(buildSearchPath('stockholm', 1, { genre: 'Rock', style: 'Grunge' })).toBe(
      '/app/search?q=stockholm&genre=Rock&style=Grunge',
    );
  });

  it('trims filter values and drops whitespace-only ones (feature 021)', () => {
    expect(buildSearchPath('stockholm', 1, { genre: '  Rock  ', style: '   ' })).toBe(
      '/app/search?q=stockholm&genre=Rock',
    );
  });

  it('joins a format array into a single comma-separated param, in canonical FORMAT_OPTIONS order (feature 022)', () => {
    expect(buildSearchPath('stockholm', 1, { format: ['CD', 'Vinyl'] })).toBe(
      '/app/search?q=stockholm&format=Vinyl%2CCD',
    );
  });

  it('omits the format param entirely when the array is empty (FR-005, feature 022)', () => {
    expect(buildSearchPath('stockholm', 1, { genre: 'Rock', format: [] })).toBe(
      '/app/search?q=stockholm&genre=Rock',
    );
  });

  it('does not accept/encode an artist filter (FR-001, feature 022, US2)', () => {
    // @ts-expect-error artist is no longer part of SearchFilters (feature 022)
    expect(buildSearchPath('stockholm', 1, { artist: 'Nirvana', genre: 'Rock' })).toBe(
      '/app/search?q=stockholm&genre=Rock',
    );
  });

  it('round-trips text filters through a built URL so a reload reproduces the identical filtered request (FR-007, Acceptance Scenario 3)', () => {
    const filters = { genre: 'Rock', style: 'Grunge' };
    const path = buildSearchPath('nevermind', 3, filters);

    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper([path]),
    });

    expect(result.current).toEqual({ query: 'nevermind', page: 3, ...filters });
  });

  it('round-trips a format selection through a built URL, reproducing the identical array (FR-007, SC-003, feature 022)', () => {
    const filters = { format: ['Vinyl', 'CD'] };
    const path = buildSearchPath('nevermind', 3, filters);

    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper([path]),
    });

    expect(result.current).toEqual({ query: 'nevermind', page: 3, format: ['Vinyl', 'CD'] });
  });
});

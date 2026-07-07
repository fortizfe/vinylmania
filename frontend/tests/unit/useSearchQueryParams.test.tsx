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

  it('parses artist/genre/style/format filters from the URL (feature 021)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&genre=Rock&format=Vinyl']),
    });

    expect(result.current).toEqual({ query: 'nirvana', page: 1, genre: 'Rock', format: 'Vinyl' });
  });

  it('omits a filter entirely when its URL param is absent or blank (feature 021)', () => {
    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper(['/app/search?q=nirvana&genre=Rock&artist=%20%20&style=']),
    });

    expect(result.current).toEqual({ query: 'nirvana', page: 1, genre: 'Rock' });
    expect(result.current.artist).toBeUndefined();
    expect(result.current.style).toBeUndefined();
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

  it('encodes non-empty filters and omits unset ones (feature 021)', () => {
    expect(buildSearchPath('stockholm', 1, { genre: 'Rock', format: 'Vinyl' })).toBe(
      '/app/search?q=stockholm&genre=Rock&format=Vinyl',
    );
  });

  it('trims filter values and drops whitespace-only ones (feature 021)', () => {
    expect(buildSearchPath('stockholm', 1, { genre: '  Rock  ', artist: '   ' })).toBe(
      '/app/search?q=stockholm&genre=Rock',
    );
  });

  it('round-trips filters through a built URL so a reload reproduces the identical filtered request (FR-007, Acceptance Scenario 3)', () => {
    const filters = { artist: 'Nirvana', genre: 'Rock', style: 'Grunge', format: 'Vinyl' };
    const path = buildSearchPath('nevermind', 3, filters);

    const { result } = renderHook(() => useSearchQueryParams(), {
      wrapper: wrapper([path]),
    });

    expect(result.current).toEqual({ query: 'nevermind', page: 3, ...filters });
  });
});

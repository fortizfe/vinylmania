import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
  buildLibraryPath,
  useLibraryQueryParams,
} from '../../../src/hooks/useLibraryQueryParams';
import { DEFAULT_LIBRARY_SORT } from '../../../src/constants/librarySortOptions';

function wrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe('useLibraryQueryParams (feature 038, US2, FR-010/FR-022)', () => {
  it('defaults to page 1 with no active filters when no query params are present', () => {
    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper(['/app/library']),
    });

    // 068: the default sort is part of the parsed state (data-model §2).
    expect(result.current).toEqual({ page: 1, sort: DEFAULT_LIBRARY_SORT });
  });

  it('parses the page number from the URL', () => {
    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper(['/app/library?page=3']),
    });

    expect(result.current.page).toBe(3);
  });

  it('parses comma-joined genre/style/format params into arrays, in canonical catalog order', () => {
    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper([
        '/app/library?genre=Rock,Electronic&style=Shoegaze,Grunge&format=CD,Vinyl',
      ]),
    });

    expect(result.current.genre).toEqual(['Electronic', 'Rock']);
    expect(result.current.style).toEqual(['Grunge', 'Shoegaze']);
    expect(result.current.format).toEqual(['CD', 'Vinyl']);
  });

  it('drops values not present in their catalogs while keeping recognized ones', () => {
    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper(['/app/library?genre=Rock,NotAGenre']),
    });

    expect(result.current.genre).toEqual(['Rock']);
  });

  it('omits a filter entirely when its URL param has no recognized values', () => {
    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper(['/app/library']),
    });

    expect(result.current.genre).toBeUndefined();
    expect(result.current.style).toBeUndefined();
    expect(result.current.format).toBeUndefined();
  });
});

describe('useLibraryQueryParams sort (feature 068, US1, FR-006/FR-007, data-model §2)', () => {
  function parse(path: string) {
    return renderHook(() => useLibraryQueryParams(), { wrapper: wrapper([path]) }).result
      .current;
  }

  it('defaults to date added, newest first, when no sort params are present', () => {
    expect(parse('/app/library').sort).toEqual({ sort: 'added', dir: 'desc' });
  });

  it('parses a valid sort and dir pair as given', () => {
    expect(parse('/app/library?sort=artist&dir=desc').sort).toEqual({
      sort: 'artist',
      dir: 'desc',
    });
    expect(parse('/app/library?sort=album&dir=asc').sort).toEqual({
      sort: 'album',
      dir: 'asc',
    });
    expect(parse('/app/library?sort=added&dir=asc').sort).toEqual({
      sort: 'added',
      dir: 'asc',
    });
  });

  it('falls back to the default for an unknown sort, never erroring', () => {
    expect(parse('/app/library?sort=foo').sort).toEqual({ sort: 'added', dir: 'desc' });
  });

  it('uses the criterion default direction when dir is absent (asc for artist/album)', () => {
    expect(parse('/app/library?sort=artist').sort).toEqual({
      sort: 'artist',
      dir: 'asc',
    });
    expect(parse('/app/library?sort=album').sort).toEqual({ sort: 'album', dir: 'asc' });
  });

  it('uses the criterion default direction when dir is unknown (desc for added)', () => {
    expect(parse('/app/library?sort=added&dir=up').sort).toEqual({
      sort: 'added',
      dir: 'desc',
    });
  });

  it('keeps the filters alongside the sort', () => {
    const parsed = parse('/app/library?sort=artist&dir=asc&genre=Rock');
    expect(parsed.sort).toEqual({ sort: 'artist', dir: 'asc' });
    expect(parsed.genre).toEqual(['Rock']);
  });
});

describe('buildLibraryPath(filters?, sort?, page = 1) (feature 068 interim signature)', () => {
  it('builds the base path with no filters/sort/page', () => {
    expect(buildLibraryPath()).toBe('/app/library');
  });

  it('includes the page number when greater than 1', () => {
    expect(buildLibraryPath(undefined, undefined, 2)).toBe('/app/library?page=2');
  });

  it('omits the page number when it is 1', () => {
    expect(buildLibraryPath(undefined, undefined, 1)).toBe('/app/library');
  });

  it('joins genre/style/format arrays into comma-separated params, in canonical catalog order', () => {
    expect(buildLibraryPath({ genre: ['Rock', 'Electronic'] })).toBe(
      '/app/library?genre=Electronic%2CRock',
    );
  });

  it('resets to page 1 in the built path when filters change (FR-010)', () => {
    const path = buildLibraryPath({ genre: ['Rock'] });
    expect(path).not.toMatch(/page=/);
  });

  it('omits both sort and dir for the default sort', () => {
    expect(buildLibraryPath(undefined, DEFAULT_LIBRARY_SORT)).toBe('/app/library');
    expect(buildLibraryPath({ genre: ['Rock'] }, { sort: 'added', dir: 'desc' })).toBe(
      '/app/library?genre=Rock',
    );
  });

  it('writes both sort and dir for a non-default sort, even when dir is the criterion default', () => {
    const params = new URLSearchParams(
      buildLibraryPath(undefined, { sort: 'artist', dir: 'asc' }).split('?')[1],
    );
    expect(params.get('sort')).toBe('artist');
    expect(params.get('dir')).toBe('asc');

    const oldest = new URLSearchParams(
      buildLibraryPath(undefined, { sort: 'added', dir: 'asc' }).split('?')[1],
    );
    expect(oldest.get('sort')).toBe('added');
    expect(oldest.get('dir')).toBe('asc');
  });

  it('writes sort, dir, filters and page together', () => {
    const params = new URLSearchParams(
      buildLibraryPath({ genre: ['Rock'] }, { sort: 'album', dir: 'desc' }, 3).split(
        '?',
      )[1],
    );
    expect(params.get('sort')).toBe('album');
    expect(params.get('dir')).toBe('desc');
    expect(params.get('genre')).toBe('Rock');
    expect(params.get('page')).toBe('3');
  });

  it('round-trips filters, sort and page through a built URL (FR-022, FR-006)', () => {
    const filters = { genre: ['Rock'], style: ['Grunge'], format: ['Vinyl'] };
    const sort = { sort: 'artist', dir: 'desc' } as const;
    const path = buildLibraryPath(filters, sort, 2);

    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper([path]),
    });

    expect(result.current).toEqual({ page: 2, sort, ...filters });
  });
});

/**
 * Feature 068, US2 (T028) — infinite scroll removes paging from the URL
 * (research D12, spec edge case "legacy ?page=N links"). The final signature
 * is `buildLibraryPath(filters?, sort?)` and the hook no longer returns
 * `page`; a legacy `?page=N` is parsed by nobody and never written back.
 */
describe('useLibraryQueryParams without paging (feature 068, US2)', () => {
  /** Calls the final two-argument builder even where a third is still declared. */
  const build = buildLibraryPath as (
    filters?: Parameters<typeof buildLibraryPath>[0],
    sort?: Parameters<typeof buildLibraryPath>[1],
    legacyPage?: number,
  ) => string;

  it('no longer returns a page: infinite scroll owns the batch cursor', () => {
    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper(['/app/library']),
    });

    expect(result.current).toEqual({ sort: DEFAULT_LIBRARY_SORT });
    expect('page' in result.current).toBe(false);
  });

  it('ignores a legacy ?page=3 while keeping the sort and filters of the same URL', () => {
    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper(['/app/library?page=3&sort=album&dir=desc&genre=Rock']),
    });

    expect('page' in result.current).toBe(false);
    expect(result.current.sort).toEqual({ sort: 'album', dir: 'desc' });
    expect(result.current.genre).toEqual(['Rock']);
  });

  it('never writes a page param, whatever is passed', () => {
    expect(build()).toBe('/app/library');
    expect(build(undefined, undefined, 3)).toBe('/app/library');
    expect(build({ genre: ['Rock'] }, { sort: 'artist', dir: 'asc' }, 2)).not.toMatch(
      /page=/,
    );
  });

  it('round-trips filters and sort through a built URL with no paging (FR-006, FR-007)', () => {
    const filters = { genre: ['Rock'], style: ['Grunge'], format: ['Vinyl'] };
    const sort = { sort: 'artist', dir: 'desc' } as const;

    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper([build(filters, sort)]),
    });

    expect(result.current).toEqual({ sort, ...filters });
  });
});

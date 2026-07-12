import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
  buildLibraryPath,
  useLibraryQueryParams,
} from '../../../src/hooks/useLibraryQueryParams';

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

    expect(result.current).toEqual({ page: 1 });
  });

  it('parses the page number from the URL', () => {
    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper(['/app/library?page=3']),
    });

    expect(result.current.page).toBe(3);
  });

  it('parses comma-joined genre/style/format params into arrays, in canonical catalog order', () => {
    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper(['/app/library?genre=Rock,Electronic&style=Shoegaze,Grunge&format=CD,Vinyl']),
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

describe('buildLibraryPath', () => {
  it('builds the base path with no page/filters', () => {
    expect(buildLibraryPath()).toBe('/app/library');
  });

  it('includes the page number when greater than 1', () => {
    expect(buildLibraryPath(2)).toBe('/app/library?page=2');
  });

  it('omits the page number when it is 1', () => {
    expect(buildLibraryPath(1)).toBe('/app/library');
  });

  it('joins genre/style/format arrays into comma-separated params, in canonical catalog order', () => {
    expect(buildLibraryPath(1, { genre: ['Rock', 'Electronic'] })).toBe(
      '/app/library?genre=Electronic%2CRock',
    );
  });

  it('resets to page 1 in the built path when filters change (FR-010)', () => {
    const path = buildLibraryPath(1, { genre: ['Rock'] });
    expect(path).not.toMatch(/page=/);
  });

  it('round-trips genre/style/format arrays through a built URL (FR-022)', () => {
    const filters = { genre: ['Rock'], style: ['Grunge'], format: ['Vinyl'] };
    const path = buildLibraryPath(2, filters);

    const { result } = renderHook(() => useLibraryQueryParams(), {
      wrapper: wrapper([path]),
    });

    expect(result.current).toEqual({ page: 2, ...filters });
  });
});

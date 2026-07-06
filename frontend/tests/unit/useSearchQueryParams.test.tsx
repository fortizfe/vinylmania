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
});

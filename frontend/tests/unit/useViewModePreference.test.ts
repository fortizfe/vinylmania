import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useViewModePreference } from '../../src/hooks/useViewModePreference';

const SEARCH_KEY = 'vinylmania:view-mode:search';
const LIBRARY_KEY = 'vinylmania:view-mode:library';

beforeEach(() => {
  window.localStorage.clear();
});

describe('useViewModePreference', () => {
  it('defaults to grid when the storage key is absent', () => {
    const { result } = renderHook(() => useViewModePreference(SEARCH_KEY));

    expect(result.current.mode).toBe('grid');
  });

  it('defaults to grid when the storage key holds a value other than grid/list', () => {
    window.localStorage.setItem(SEARCH_KEY, 'carousel');

    const { result } = renderHook(() => useViewModePreference(SEARCH_KEY));

    expect(result.current.mode).toBe('grid');
  });

  it('reads an existing stored list preference on mount', () => {
    window.localStorage.setItem(SEARCH_KEY, 'list');

    const { result } = renderHook(() => useViewModePreference(SEARCH_KEY));

    expect(result.current.mode).toBe('list');
  });

  it('setMode updates the returned state and writes through to the given key', () => {
    const { result } = renderHook(() => useViewModePreference(SEARCH_KEY));

    act(() => {
      result.current.setMode('list');
    });

    expect(result.current.mode).toBe('list');
    expect(window.localStorage.getItem(SEARCH_KEY)).toBe('list');
  });

  it('two hook instances with different keys never share state', () => {
    const search = renderHook(() => useViewModePreference(SEARCH_KEY));
    const library = renderHook(() => useViewModePreference(LIBRARY_KEY));

    act(() => {
      search.result.current.setMode('list');
    });

    expect(search.result.current.mode).toBe('list');
    expect(library.result.current.mode).toBe('grid');
    expect(window.localStorage.getItem(LIBRARY_KEY)).toBeNull();
  });
});

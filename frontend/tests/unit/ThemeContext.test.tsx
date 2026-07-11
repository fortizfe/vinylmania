import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from '../../src/theme/ThemeContext';

type Listener = (event: Pick<MediaQueryListEvent, 'matches'>) => void;

function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<Listener>();

  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
  };

  window.matchMedia = vi.fn().mockReturnValue(mql);

  return {
    fireChange: (nextMatches: boolean) => {
      matches = nextMatches;
      listeners.forEach((listener) => listener({ matches: nextMatches }));
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ThemeProvider / useTheme', () => {
  it('resolves to the OS preference when there is no explicit preference', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies the dark class when setTheme("dark") is called', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setTheme('dark'));

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes the dark class when setTheme("light") is called', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setTheme('light'));

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('keeps an explicit preference even after the OS setting changes', () => {
    const { fireChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setTheme('dark'));
    expect(result.current.theme).toBe('dark');

    act(() => fireChange(false));

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

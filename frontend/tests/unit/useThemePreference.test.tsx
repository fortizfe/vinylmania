import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../../src/theme/ThemeContext';
import { useThemePreference } from '../../src/theme/useThemePreference';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useSetThemePreference: vi.fn(),
}));

vi.mock('../../src/auth/AuthContext', () => ({ useAuth: mocks.useAuth }));
vi.mock('../../src/queries/themePreferenceQueries', () => ({
  useSetThemePreference: mocks.useSetThemePreference,
}));

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

/** A promise plus externally-callable resolve/reject, for controlling mutateAsync timing. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  mocks.useAuth.mockReturnValue({ user: null });
  mocks.useSetThemePreference.mockReturnValue({ mutateAsync: vi.fn() });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useThemePreference', () => {
  it('reconciles a divergent local theme with the Firestore-sourced value once the account loads', async () => {
    mocks.useAuth.mockReturnValue({ user: { uid: 'u1', themePreference: 'dark' } });

    const { result } = renderHook(() => useThemePreference(), { wrapper });

    await waitFor(() => expect(result.current.theme).toBe('dark'));
  });

  it('calls the save mutation with the new value when signed in', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mocks.useAuth.mockReturnValue({ user: { uid: 'u1' } });
    mocks.useSetThemePreference.mockReturnValue({ mutateAsync });

    const { result } = renderHook(() => useThemePreference(), { wrapper });

    await act(async () => {
      result.current.toggle();
    });

    expect(mutateAsync).toHaveBeenCalledWith('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('does not call the save mutation when signed out, but still updates the local theme', async () => {
    const mutateAsync = vi.fn();
    mocks.useAuth.mockReturnValue({ user: null });
    mocks.useSetThemePreference.mockReturnValue({ mutateAsync });

    const { result } = renderHook(() => useThemePreference(), { wrapper });

    act(() => {
      result.current.toggle();
    });

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(result.current.theme).toBe('dark');
  });

  it('sets saveFailed once the mutation ultimately rejects', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('network down'));
    mocks.useAuth.mockReturnValue({ user: { uid: 'u1' } });
    mocks.useSetThemePreference.mockReturnValue({ mutateAsync });

    const { result } = renderHook(() => useThemePreference(), { wrapper });

    await act(async () => {
      result.current.toggle();
    });

    await waitFor(() => expect(result.current.saveFailed).toBe(true));
  });

  it('clears a previous saveFailed flag once a subsequent save succeeds', async () => {
    const mutateAsync = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(undefined);
    mocks.useAuth.mockReturnValue({ user: { uid: 'u1' } });
    mocks.useSetThemePreference.mockReturnValue({ mutateAsync });

    const { result } = renderHook(() => useThemePreference(), { wrapper });

    await act(async () => {
      result.current.toggle();
    });
    await waitFor(() => expect(result.current.saveFailed).toBe(true));

    await act(async () => {
      result.current.toggle();
    });
    await waitFor(() => expect(result.current.saveFailed).toBe(false));
  });

  it('rapid toggles only ever send the latest pending value, never an overlapping stale one', async () => {
    const first = deferred<void>();
    const mutateAsync = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    mocks.useAuth.mockReturnValue({ user: { uid: 'u1' } });
    mocks.useSetThemePreference.mockReturnValue({ mutateAsync });

    const { result } = renderHook(() => useThemePreference(), { wrapper });

    act(() => {
      result.current.toggle(); // light -> dark, save in flight
    });
    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggle(); // dark -> light, while the 'dark' save is still pending
    });
    expect(result.current.theme).toBe('light');

    // Only one call so far — the second toggle must not fire an overlapping request.
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenNthCalledWith(1, 'dark');

    await act(async () => {
      first.resolve();
      await first.promise;
    });

    // Once the in-flight save settles, the coalesced latest value ('light') is sent.
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync).toHaveBeenNthCalledWith(2, 'light');
    expect(result.current.theme).toBe('light');
  });
});

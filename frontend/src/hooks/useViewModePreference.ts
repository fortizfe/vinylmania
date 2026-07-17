import { useCallback, useState } from 'react';

export type ViewMode = 'grid' | 'list';

function isViewMode(value: unknown): value is ViewMode {
  return value === 'grid' || value === 'list';
}

function readStoredMode(storageKey: string): ViewMode | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(storageKey);
  return isViewMode(stored) ? stored : null;
}

/**
 * Per-screen grid/list presentation preference, persisted locally under the
 * given key (e.g. `vinylmania:view-mode:search`). Purely local/device —
 * two independent call sites with different keys never share state, unlike
 * `ThemeContext`'s single, remotely-synced value (spec FR-003).
 */
export function useViewModePreference(storageKey: string) {
  const [mode, setModeState] = useState<ViewMode>(
    () => readStoredMode(storageKey) ?? 'grid',
  );

  const setMode = useCallback(
    (next: ViewMode) => {
      setModeState(next);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, next);
      }
    },
    [storageKey],
  );

  return { mode, setMode };
}

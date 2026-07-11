import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { useSetThemePreference } from '../queries/themePreferenceQueries';
import { useTheme, type Theme } from './ThemeContext';

interface UseThemePreferenceResult {
  theme: Theme;
  toggle: () => void;
  /** True once a preference save has failed after exhausting its retries (FR-011). */
  saveFailed: boolean;
}

/**
 * Combines ThemeContext's local/session theme state with Firebase-backed
 * persistence for signed-in users: reconciles a divergent local value with
 * the account's saved preference (Firestore wins, research.md R3), and
 * saves toggles with a sequenced "latest value wins" queue so rapid
 * successive toggles never send a stale, out-of-order value (spec edge
 * case, research.md-adjacent tasks.md T019a).
 */
export function useThemePreference(): UseThemePreferenceResult {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const setThemePreference = useSetThemePreference();
  const [saveFailed, setSaveFailed] = useState(false);

  const pendingValueRef = useRef<Theme | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (user?.themePreference && user.themePreference !== theme) {
      setTheme(user.themePreference);
    }
    // Only re-reconcile when the account's saved value changes/loads — not
    // on every local theme change, or this would fight the user's own toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.themePreference]);

  const runSaveLoop = useCallback(() => {
    if (isSavingRef.current) return;
    const value = pendingValueRef.current;
    if (value === null) return;

    isSavingRef.current = true;
    setThemePreference.mutateAsync(value).then(
      () => {
        isSavingRef.current = false;
        if (pendingValueRef.current === value) {
          pendingValueRef.current = null;
          setSaveFailed(false);
        } else {
          runSaveLoop();
        }
      },
      () => {
        isSavingRef.current = false;
        setSaveFailed(true);
        if (pendingValueRef.current !== value) {
          runSaveLoop();
        }
      },
    );
  }, [setThemePreference]);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);

    if (!user) return;

    pendingValueRef.current = next;
    runSaveLoop();
  }, [theme, setTheme, user, runSaveLoop]);

  return { theme, toggle, saveFailed };
}

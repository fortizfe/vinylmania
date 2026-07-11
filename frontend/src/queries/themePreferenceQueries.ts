import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import * as themePreferenceApi from '../services/themePreferenceApi';
import type { ThemePreference } from '../services/themePreferenceApi';

// research.md R4a: 3 retries with exponential backoff (1s/2s/4s), then the
// save is considered "ultimately failed" (FR-011).
const RETRY_DELAYS_MS = [1000, 2000, 4000];

export function useSetThemePreference(): UseMutationResult<void, unknown, ThemePreference> {
  return useMutation({
    mutationFn: themePreferenceApi.setThemePreference,
    retry: RETRY_DELAYS_MS.length,
    retryDelay: (attemptIndex) => RETRY_DELAYS_MS[attemptIndex] ?? RETRY_DELAYS_MS.at(-1)!,
  });
}

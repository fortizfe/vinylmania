import { isAxiosError } from 'axios';

export type RetryableFailureReason = 'rate_limited' | 'unavailable';

/** 1 original attempt + 2 retries (spec FR-010). */
export const MAX_ATTEMPTS = 3;

/**
 * Per-attempt HTTP timeout for retry-scoped catalog calls (research.md §4).
 * Shorter than the old blanket 10s default so 3 attempts can't compound
 * into a multi-tens-of-seconds hang (spec SC-002). The rating lookup keeps
 * its own separate 2s override, unaffected by this constant.
 */
export const PER_ATTEMPT_TIMEOUT_MS = 4_000;

const BASE_DELAY_MS: Record<number, number> = { 2: 300, 3: 900 };
const JITTER_RATIO = 0.2;

/**
 * Classifies an error from the shared Discogs HTTP client as retryable or
 * not (spec FR-001/FR-002). Only a 429 (rate-limited) or a 5xx/network
 * failure is retryable; 404, 401/403, and anything else is not.
 */
export function classifyForRetry(error: unknown): RetryableFailureReason | null {
  if (!isAxiosError(error)) {
    return null;
  }

  if (!error.response) {
    // Network error / timeout — no HTTP response was ever received.
    return 'unavailable';
  }

  const { status } = error.response;
  if (status === 429) {
    return 'rate_limited';
  }
  if (status >= 500 && status < 600) {
    return 'unavailable';
  }
  return null;
}

/**
 * Fixed increasing-backoff schedule (spec FR-003, Clarifications): the same
 * delay applies regardless of which transient condition triggered the
 * retry. `attempt` is the attempt number about to be made (2 or 3).
 * ±20% jitter avoids many concurrent requests retrying in lockstep.
 */
export function backoffDelayMs(attempt: number): number {
  const base = BASE_DELAY_MS[attempt] ?? 0;
  const jitter = base * JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

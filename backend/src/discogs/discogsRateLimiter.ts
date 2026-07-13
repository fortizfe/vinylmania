import { logger } from '../config/logger';

/**
 * Shared, process-local preventive throttle for both Discogs HTTP clients
 * (spec FR-001–FR-006, FR-008, FR-015; research.md §1/§2). Reads the
 * `X-Discogs-Ratelimit*` headers Discogs already returns on every response
 * and spaces outgoing requests out once the estimated remaining per-minute
 * budget drops to/below a safety threshold — rather than waiting for
 * Discogs to return a 429. A module-level singleton, matching the reuse
 * pattern of `discogsCircuitBreaker.ts` — best-effort per warm process, not
 * globally coordinated across serverless instances.
 */

export const DEFAULT_LIMIT = 60;
export const SAFETY_THRESHOLD_RATIO = 0.15;
export const MAX_WAIT_MS = 1_500;
export const WINDOW_MS = 60_000;

interface RateLimitState {
  limit: number;
  remaining: number;
  windowResetAt: number;
}

function coldStartState(): RateLimitState {
  return {
    limit: DEFAULT_LIMIT,
    remaining: DEFAULT_LIMIT,
    windowResetAt: Date.now() + WINDOW_MS,
  };
}

let state: RateLimitState = coldStartState();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Reserves one outgoing-request slot. Called once per outgoing HTTP
 * attempt (original or retried) from the request interceptor of both the
 * catalog and collection clients. Never rejects — an internal error while
 * computing the delay degrades to zero delay (FR-005).
 */
export async function acquireSlot(): Promise<void> {
  const remainingBeforeDecrement = state.remaining;
  const limitAtCall = state.limit;
  let delayMs = 0;

  try {
    const threshold = Math.ceil(limitAtCall * SAFETY_THRESHOLD_RATIO);
    if (remainingBeforeDecrement <= threshold) {
      const windowRemainingMs = Math.max(0, state.windowResetAt - Date.now());
      delayMs = Math.min(MAX_WAIT_MS, windowRemainingMs / Math.max(remainingBeforeDecrement, 1));
    }
    state.remaining -= 1;
  } catch (err) {
    logger.warn({
      route: 'discogs:throttle',
      outcome: 'throttle_unavailable',
      message: err instanceof Error ? err.message : 'unknown error',
    });
    return;
  }

  if (delayMs > 0) {
    logger.info({
      route: 'discogs:throttle',
      outcome: 'throttled',
      meta: { delayMs, remaining: remainingBeforeDecrement, limit: limitAtCall },
    });
    await wait(delayMs);
  }
}

/**
 * Corrects the shared budget estimate from Discogs' own rate-limit headers
 * (research.md §1). Called from the response interceptor of both clients on
 * every response (success or error). A response with no/non-numeric
 * headers is a no-op.
 */
export function recordRateLimitHeaders(headers: Record<string, unknown>): void {
  const limit = Number(headers['x-discogs-ratelimit']);
  const remaining = Number(headers['x-discogs-ratelimit-remaining']);
  if (!Number.isFinite(limit) || !Number.isFinite(remaining)) {
    return;
  }
  state = { limit, remaining, windowResetAt: Date.now() + WINDOW_MS };
}

/** Test-only: restores the singleton to its cold-start defaults. */
export function __resetRateLimiterForTests(): void {
  state = coldStartState();
}

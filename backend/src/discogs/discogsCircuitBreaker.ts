/**
 * App-wide circuit breaker for the shared Discogs catalog HTTP client
 * (spec FR-011). A module-level singleton, matching the reuse pattern of
 * `sharedClient` in discogsClient.ts — best-effort per warm process, not
 * globally coordinated across serverless instances (research.md §7).
 *
 * Two states plus a cooldown (data-model.md "Circuit Breaker State"):
 *  - closed: requests proceed normally; a request whose retries are fully
 *    exhausted counts as one strike within a rolling window.
 *  - open: new requests fail fast (no network call) until the cooldown
 *    elapses.
 *  - half-open: after the cooldown, requests are let through again; a
 *    success closes the breaker, a failure reopens it with a fresh cooldown.
 */

const FAILURE_WINDOW_MS = 30_000;
const FAILURE_THRESHOLD = 5;
const OPEN_COOLDOWN_MS = 20_000;

type BreakerState = 'closed' | 'open' | 'half-open';

let state: BreakerState = 'closed';
let recentFailureTimestamps: number[] = [];
let openedAt: number | null = null;

function pruneOldFailures(now: number): void {
  recentFailureTimestamps = recentFailureTimestamps.filter(
    (timestamp) => now - timestamp < FAILURE_WINDOW_MS,
  );
}

/**
 * Checks (and, if the cooldown has elapsed, transitions) the breaker's
 * state. Returns true when a request should fail fast without ever being
 * attempted; false when it should proceed (closed, or the one half-open
 * trial window).
 */
export function shouldShortCircuit(): boolean {
  if (state !== 'open') {
    return false;
  }

  const now = Date.now();
  if (openedAt !== null && now - openedAt >= OPEN_COOLDOWN_MS) {
    state = 'half-open';
    return false;
  }

  return true;
}

/** Records one request whose retries were fully exhausted (one strike). */
export function recordExhaustedFailure(): void {
  const now = Date.now();

  if (state === 'half-open') {
    // The trial request failed — reopen with a fresh cooldown.
    state = 'open';
    openedAt = now;
    recentFailureTimestamps = [now];
    return;
  }

  pruneOldFailures(now);
  recentFailureTimestamps.push(now);

  if (recentFailureTimestamps.length >= FAILURE_THRESHOLD) {
    state = 'open';
    openedAt = now;
  }
}

/** Records one request that ultimately succeeded. Closes a half-open trial. */
export function recordSuccess(): void {
  if (state === 'half-open') {
    state = 'closed';
    recentFailureTimestamps = [];
    openedAt = null;
  }
}

/** Test-only: resets the singleton to its default closed state. */
export function __resetCircuitBreakerForTests(): void {
  state = 'closed';
  recentFailureTimestamps = [];
  openedAt = null;
}

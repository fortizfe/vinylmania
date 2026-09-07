import axios, { type AxiosError, isAxiosError } from 'axios';

import { logger } from '../../config/logger';
import {
  isReliableUpcMatch,
  pickReliableSearchMatch,
  type StreamingCandidate,
} from '../../domain/streaming/matching';
import {
  StreamingRateLimitedError,
  StreamingResolutionError,
  StreamingUnavailableError,
} from '../../domain/streaming/streamingErrors';
import type {
  ResolvedStreamingLink,
  StreamingLinkQuery,
} from '../../domain/streaming/types';
import type { StreamingResolverPort } from '../../ports/streaming/streamingResolverPort';

const PLATFORM = 'apple_music' as const;

/**
 * Log routes for this adapter's outbound-call diagnostics. Kept distinct from
 * the `/api/streaming/links` request route so an operator can grep the
 * adapter's own throttle/retry behaviour in isolation when Apple Music links
 * go missing (Constitution V).
 */
const ITUNES_LOG_ROUTE = 'streaming:itunes';
const ITUNES_THROTTLE_LOG_ROUTE = 'streaming:itunes:throttle';

const DEFAULT_ITUNES_BASE_URL = 'https://itunes.apple.com';
/** Bounds one iTunes call. The section must resolve within ~2s p95 (plan.md). */
const PER_CALL_TIMEOUT_MS = 4000;
/** One retry only, for a hard connection failure or a 5xx (research.md §1). */
const RETRY_BACKOFF_MS = 500;
const MAX_ATTEMPTS = 2;

/** Read at call time (mirrors `getDiscogsBaseUrl`) so tests can point it at nock. */
function itunesBaseUrl(): string {
  return process.env.ITUNES_SEARCH_BASE_URL ?? DEFAULT_ITUNES_BASE_URL;
}

interface ItunesResponseShape {
  resultCount?: number;
  results?: StreamingCandidate[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * In-process minimum-interval throttle for outbound iTunes Search calls
 * (research.md §2). The 90-day resolution cache already makes calls rare;
 * this bounds a burst of cache-misses to iTunes' documented ~20 req/min
 * limit by spacing outbound calls at least `MIN_ITUNES_INTERVAL_MS` apart.
 *
 * A call that arrives inside the current window waits at most one interval —
 * so the common barcode-miss → text-fallback pair within a single `resolve()`
 * still completes. At most ONE such waiter is allowed at a time; a further
 * call that would have to queue behind it fails fast with
 * `StreamingRateLimitedError`, which `resolveStreamingLinks` never caches, so
 * the record stays eligible for a later view. No queue, no Redis, no external
 * library (KISS) — a module-level singleton, best-effort per warm process,
 * matching `discogsRateLimiter`'s reuse pattern.
 */
export const MIN_ITUNES_INTERVAL_MS = 3_000;
const MAX_ITUNES_WAITERS = 1;

let itunesNextAllowedAt = 0;
let itunesWaiters = 0;

export async function throttleItunesCall(): Promise<void> {
  const now = Date.now();

  if (now >= itunesNextAllowedAt) {
    itunesNextAllowedAt = now + MIN_ITUNES_INTERVAL_MS;
    return;
  }

  if (itunesWaiters >= MAX_ITUNES_WAITERS) {
    // Distinct from an Apple-side 403: the call never left the process. Without
    // this line a burst of cache-misses tripping the local throttle is
    // indistinguishable in the logs from iTunes rate-limiting us, yet the two
    // need opposite remediation.
    logger.warn({
      route: ITUNES_THROTTLE_LOG_ROUTE,
      outcome: 'rate_limited',
      meta: {
        reason: 'local_min_interval_exceeded',
        minIntervalMs: MIN_ITUNES_INTERVAL_MS,
      },
    });
    throw new StreamingRateLimitedError(
      new Error('iTunes minimum-interval throttle: outbound call rate exceeded'),
    );
  }

  const waitMs = itunesNextAllowedAt - now;
  itunesNextAllowedAt += MIN_ITUNES_INTERVAL_MS;
  itunesWaiters += 1;
  logger.info({
    route: ITUNES_THROTTLE_LOG_ROUTE,
    outcome: 'throttled',
    meta: { waitMs },
  });
  try {
    await delay(waitMs);
  } finally {
    itunesWaiters -= 1;
  }
}

/** Test-only: restores the throttle singleton to its cold-start state. */
export function __resetItunesThrottleForTests(): void {
  itunesNextAllowedAt = 0;
  itunesWaiters = 0;
}

/**
 * Parses an iTunes body. Apple sometimes serves JSON as `text/javascript`, so
 * the response is fetched as text and parsed here regardless of content-type.
 * An unparseable body is a transient failure — never a silently-wrong link.
 */
function parseItunesBody(raw: unknown): ItunesResponseShape {
  if (raw && typeof raw === 'object') {
    return raw as ItunesResponseShape;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as ItunesResponseShape;
    } catch (err) {
      throw new StreamingUnavailableError(err);
    }
  }
  throw new StreamingUnavailableError(new Error('Unexpected iTunes response body'));
}

/** A hard connection failure is retryable; a timeout is not (fail fast — plan.md p95 budget). */
function isRetryableNetworkError(err: AxiosError): boolean {
  return (
    err.code === 'ECONNRESET' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'EAI_AGAIN'
  );
}

async function itunesGet(
  path: string,
  params: Record<string, string | number>,
): Promise<ItunesResponseShape> {
  // Bound a burst of cache-misses against iTunes' ~20 req/min limit
  // (research.md §2). Throttled once per outbound call; the retry loop below
  // does not re-gate (one retry is rare and already bounded).
  await throttleItunesCall();

  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await axios.get(`${itunesBaseUrl()}${path}`, {
        params,
        timeout: PER_CALL_TIMEOUT_MS,
        responseType: 'text',
        transformResponse: (data: unknown) => data,
      });
      return parseItunesBody(response.data);
    } catch (err) {
      if (err instanceof StreamingResolutionError) {
        throw err;
      }
      if (!isAxiosError(err)) {
        throw new StreamingUnavailableError(err);
      }

      const status = err.response?.status;
      if (status === 403) {
        throw new StreamingRateLimitedError(err);
      }

      const retryable =
        status === undefined ? isRetryableNetworkError(err) : status >= 500;
      if (retryable && attempt < MAX_ATTEMPTS) {
        logger.warn({
          route: ITUNES_LOG_ROUTE,
          outcome: 'retry',
          meta: { path, attempt, status: status ?? null, code: err.code ?? null },
        });
        await delay(RETRY_BACKOFF_MS);
        continue;
      }
      throw new StreamingUnavailableError(err);
    }
  }
}

function toDigits(barcode: string): string {
  return barcode.replace(/\D/g, '');
}

function linkFrom(candidate: StreamingCandidate | null): ResolvedStreamingLink | null {
  return candidate?.collectionViewUrl
    ? { platform: PLATFORM, url: candidate.collectionViewUrl }
    : null;
}

/**
 * Apple Music resolver via the free, keyless iTunes Search API.
 * Barcode/UPC lookup(s) first (authoritative), then an artist+title text
 * search as a fallback, both against the requested storefront.
 */
async function resolve(query: StreamingLinkQuery): Promise<ResolvedStreamingLink | null> {
  const country = query.storefront;
  const upcs = Array.from(
    new Set(query.barcodes.map(toDigits).filter((upc) => upc.length > 0)),
  );

  for (const upc of upcs) {
    const body = await itunesGet('/lookup', { upc, country, entity: 'album' });
    const match = (body.results ?? []).find((candidate) =>
      isReliableUpcMatch(candidate, query),
    );
    const link = linkFrom(match ?? null);
    if (link) {
      return link;
    }
  }

  const body = await itunesGet('/search', {
    term: `${query.artist} ${query.title}`.trim(),
    country,
    media: 'music',
    entity: 'album',
    limit: 10,
  });
  return linkFrom(pickReliableSearchMatch(body.results ?? [], query));
}

export const itunesSearchAdapter: StreamingResolverPort = { platform: PLATFORM, resolve };

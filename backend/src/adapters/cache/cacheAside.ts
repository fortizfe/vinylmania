import { logger } from '../../config/logger';
import { getRedisClient } from './redisClient';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}

// Single-flight map: coalesces concurrent withCache() calls for the same key
// (e.g. enrichEntries() enriching several library entries that share a
// discogsReleaseId) into one in-flight fetch, so only the first caller ever
// reaches Redis/the fetcher and the rest await its result.
const inFlight = new Map<string, Promise<unknown>>();

// Fail-soft invalidation: a Redis outage must never fail the write that
// triggered it — the stale key simply lives out its TTL.
export async function invalidateCache(key: string): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    return;
  }
  try {
    await client.del(key);
  } catch (err) {
    logger.warn({ route: key, outcome: 'cache_unavailable', message: errorMessage(err) });
  }
}

// Cache-aside (lazy-loading) wrapper: serve from Redis when possible, fall
// back to fetcher() untouched whenever Redis is unconfigured or unavailable
// so a cache outage never fails the underlying request.
export function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing !== undefined) {
    return existing as Promise<T>;
  }

  const promise = runCacheAside(key, ttlSeconds, fetcher).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);

  return promise;
}

async function runCacheAside<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const client = getRedisClient();

  if (!client) {
    return fetcher();
  }

  try {
    const cached = await client.get(key);
    if (cached !== null) {
      logger.info({ route: key, outcome: 'cache_hit' });
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    logger.warn({ route: key, outcome: 'cache_unavailable', message: errorMessage(err) });
    return fetcher();
  }

  const result = await fetcher();

  try {
    await client.set(key, JSON.stringify(result), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ route: key, outcome: 'cache_unavailable', message: errorMessage(err) });
    return result;
  }

  logger.info({ route: key, outcome: 'cache_miss' });
  return result;
}

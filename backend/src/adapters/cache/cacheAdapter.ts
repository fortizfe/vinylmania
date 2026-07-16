import { invalidateCache, withCache as withCacheAside } from './cacheAside';
import { getRedisClient } from './redisClient';
import type { CachePort } from '../../ports/cache/cachePort';

// Fail-soft in both directions, exactly like today's isMarkerFresh/setMarker:
// without Redis every caller gets a miss/no-op (correct, just more work for
// the caller), and a write failure only means the next read misses too.
async function has(key: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) {
    return false;
  }
  try {
    return (await client.get(key)) !== null;
  } catch {
    return false;
  }
}

async function set(key: string, value: string, ttlSeconds: number): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    return;
  }
  try {
    await client.set(key, value, 'EX', ttlSeconds);
  } catch {
    // Fail-soft: the next read simply misses.
  }
}

function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  return withCacheAside(key, ttlSeconds, fetcher);
}

function invalidate(key: string): Promise<void> {
  return invalidateCache(key);
}

export const cacheAdapter: CachePort = { has, set, withCache, invalidate };

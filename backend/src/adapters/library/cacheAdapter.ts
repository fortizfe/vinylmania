import { getRedisClient } from '../../cache/redisClient';
import type { CachePort } from '../../ports/library/cachePort';

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

export const cacheAdapter: CachePort = { has, set };

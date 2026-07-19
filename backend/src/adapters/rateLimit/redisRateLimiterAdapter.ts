import { getRedisClient } from '../cache/redisClient';
import type {
  RateLimitDecision,
  RateLimiterPort,
  RateLimitTier,
} from '../../ports/rateLimit/rateLimiterPort';

const WINDOW_SECONDS = 60;
const THRESHOLDS: Record<RateLimitTier, number> = {
  strict: 10,
  standard: 100,
};

// Fail-soft in both directions, exactly like cacheAdapter's has/set: without
// Redis every caller gets "not limited" (correct, just unprotected — rate
// limiting is defense-in-depth on top of requireAuth, not the only control),
// and an outage never blocks a request the endpoint would otherwise serve.
async function checkAndIncrement(tier: RateLimitTier, ip: string): Promise<RateLimitDecision> {
  const client = getRedisClient();
  if (!client) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  try {
    const windowStart = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
    const key = `ratelimit:${tier}:${ip}:${windowStart}`;
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, WINDOW_SECONDS);
    }

    if (count > THRESHOLDS[tier]) {
      const ttl = await client.ttl(key);
      return { limited: true, retryAfterSeconds: ttl > 0 ? ttl : WINDOW_SECONDS };
    }

    return { limited: false, retryAfterSeconds: 0 };
  } catch {
    return { limited: false, retryAfterSeconds: 0 };
  }
}

export const redisRateLimiterAdapter: RateLimiterPort = { checkAndIncrement };

import { redisRateLimiterAdapter } from '../../../src/adapters/rateLimit/redisRateLimiterAdapter';

// A separate file (own Jest module registry) so getRedisClient() never sees
// a configured REDIS_URL before its first call — setupEnv.ts already blanks
// it by default, so no explicit setup is needed to exercise the "no Redis
// backend configured" fail-open path.
describe('redisRateLimiterAdapter (Redis unavailable)', () => {
  it('fails open when no REDIS_URL is configured', async () => {
    const decision = await redisRateLimiterAdapter.checkAndIncrement('strict', '3.3.3.3');
    expect(decision).toEqual({ limited: false, retryAfterSeconds: 0 });
  });
});

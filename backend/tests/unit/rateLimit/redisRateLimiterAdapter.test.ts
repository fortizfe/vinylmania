import RedisMock from 'ioredis-mock';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import { getRedisClient } from '../../../src/adapters/cache/redisClient';
import { redisRateLimiterAdapter } from '../../../src/adapters/rateLimit/redisRateLimiterAdapter';

// getRedisClient() memoizes its result on first call (see discogsRetryResilience.test.ts) —
// REDIS_URL must be set before any test in this file makes its first checkAndIncrement() call.
const originalRedisUrl = process.env.REDIS_URL;

describe('redisRateLimiterAdapter', () => {
  beforeAll(() => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  beforeEach(() => {
    // Freezes the fixed-window boundary so a test can never straddle a real
    // wall-clock minute rollover and flake.
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
  });

  afterEach(async () => {
    jest.useRealTimers();
    await getRedisClient()!.flushall();
  });

  it('allows requests under the standard tier threshold (100/60s)', async () => {
    for (let i = 0; i < 100; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const decision = await redisRateLimiterAdapter.checkAndIncrement('standard', '1.2.3.4');
      expect(decision.limited).toBe(false);
    }
  });

  it('limits the 101st request in the same window for the standard tier', async () => {
    for (let i = 0; i < 100; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await redisRateLimiterAdapter.checkAndIncrement('standard', '1.2.3.4');
    }
    const decision = await redisRateLimiterAdapter.checkAndIncrement('standard', '1.2.3.4');
    expect(decision.limited).toBe(true);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('limits the 11th request in the same window for the strict tier', async () => {
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await redisRateLimiterAdapter.checkAndIncrement('strict', '5.6.7.8');
    }
    const decision = await redisRateLimiterAdapter.checkAndIncrement('strict', '5.6.7.8');
    expect(decision.limited).toBe(true);
  });

  it('keeps counters independent per IP', async () => {
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await redisRateLimiterAdapter.checkAndIncrement('strict', '9.9.9.9');
    }
    const decision = await redisRateLimiterAdapter.checkAndIncrement('strict', '1.1.1.1');
    expect(decision.limited).toBe(false);
  });

  it('keeps counters independent per tier for the same IP', async () => {
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await redisRateLimiterAdapter.checkAndIncrement('strict', '2.2.2.2');
    }
    const decision = await redisRateLimiterAdapter.checkAndIncrement('standard', '2.2.2.2');
    expect(decision.limited).toBe(false);
  });
});

import RedisMock from 'ioredis-mock';
import request from 'supertest';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import { createApp } from '../../../src/app';
import { getRedisClient } from '../../../src/adapters/cache/redisClient';

const app = createApp();

// getRedisClient() memoizes its result on first call — REDIS_URL must be set
// before this file's first request, mirroring discogsRetryResilience.test.ts.
const originalRedisUrl = process.env.REDIS_URL;

describe('authRoutes rate limiting (standard tier)', () => {
  beforeAll(() => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  afterEach(async () => {
    await getRedisClient()!.flushall();
  });

  it('rejects the 101st request to /api/auth/me within 60s with 429 and a Retry-After header', async () => {
    for (let i = 0; i < 100; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get('/api/auth/me');
      expect(res.status).not.toBe(429);
    }

    const limited = await request(app).get('/api/auth/me');

    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.body).toEqual({
      error: 'rate_limited',
      message: 'Too many requests. Please try again shortly.',
    });
  });
});

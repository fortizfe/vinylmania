import RedisMock from 'ioredis-mock';
import request from 'supertest';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import { createApp } from '../../../src/app';
import { getRedisClient } from '../../../src/adapters/cache/redisClient';

const app = createApp();

const originalRedisUrl = process.env.REDIS_URL;

describe('discogsOauthRouter rate limiting (mixed tiers)', () => {
  beforeAll(() => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  afterEach(async () => {
    await getRedisClient()!.flushall();
  });

  it('rejects the 11th request to POST /api/discogs/oauth/request within 60s with 429 (strict tier)', async () => {
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post('/api/discogs/oauth/request');
      expect(res.status).not.toBe(429);
    }

    const limited = await request(app).post('/api/discogs/oauth/request');

    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('rejects the 101st request to GET /api/discogs/oauth/status within 60s with 429 (standard tier)', async () => {
    for (let i = 0; i < 100; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get('/api/discogs/oauth/status');
      expect(res.status).not.toBe(429);
    }

    const limited = await request(app).get('/api/discogs/oauth/status');

    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });
});

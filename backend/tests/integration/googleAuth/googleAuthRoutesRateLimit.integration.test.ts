import RedisMock from 'ioredis-mock';
import request from 'supertest';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import { createApp } from '../../../src/app';
import { getRedisClient } from '../../../src/adapters/cache/redisClient';
import { clearEmulatorFirestore } from '../../helpers/authEmulator';

const app = createApp();

const originalRedisUrl = process.env.REDIS_URL;

describe('googleAuthRoutes rate limiting (strict tier)', () => {
  beforeAll(() => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'ratelimit-test-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'ratelimit-test-client-secret';
    process.env.GOOGLE_OAUTH_CALLBACK_URL = 'http://localhost:5173/login/callback';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  afterEach(async () => {
    await getRedisClient()!.flushall();
    await clearEmulatorFirestore();
  });

  it('rejects the 11th request to GET /api/auth/google/authorize within 60s with 429 (no requireAuth precedes it — this is the login entry point itself)', async () => {
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get('/api/auth/google/authorize');
      expect(res.status).not.toBe(429);
    }

    const limited = await request(app).get('/api/auth/google/authorize');

    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });
});

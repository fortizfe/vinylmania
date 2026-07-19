import request from 'supertest';

import { createApp } from '../../../src/app';
import { clearEmulatorFirestore } from '../../helpers/authEmulator';

const app = createApp();

describe('googleAuthRoutes rate limiting (strict tier)', () => {
  beforeAll(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'ratelimit-test-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'ratelimit-test-client-secret';
    process.env.GOOGLE_OAUTH_CALLBACK_URL = 'http://localhost:5173/login/callback';
  });

  afterEach(async () => {
    await clearEmulatorFirestore();
  });

  it('rejects the 21st request to GET /api/auth/google/authorize within 60s with 429 (no requireAuth precedes it — this is the login entry point itself)', async () => {
    for (let i = 0; i < 20; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get('/api/auth/google/authorize');
      expect(res.status).not.toBe(429);
    }

    const limited = await request(app).get('/api/auth/google/authorize');

    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });
});

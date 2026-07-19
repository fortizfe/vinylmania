import request from 'supertest';

import { createApp } from '../../../src/app';

const app = createApp();

describe('authRoutes rate limiting (standard tier)', () => {
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

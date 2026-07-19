import request from 'supertest';

import { createApp } from '../../../src/app';

const app = createApp();

describe('discogsOauthRouter rate limiting (mixed tiers)', () => {
  it('rejects the 21st request to POST /api/discogs/oauth/request within 60s with 429 (strict tier)', async () => {
    for (let i = 0; i < 20; i += 1) {
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

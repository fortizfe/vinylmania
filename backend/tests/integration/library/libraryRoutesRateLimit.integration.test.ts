import request from 'supertest';

import { createApp } from '../../../src/app';

const app = createApp();

describe('libraryRoutes rate limiting (standard tier)', () => {
  it('rejects the 101st request to GET /api/library within 60s with 429', async () => {
    for (let i = 0; i < 100; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get('/api/library');
      expect(res.status).not.toBe(429);
    }

    const limited = await request(app).get('/api/library');

    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });
});

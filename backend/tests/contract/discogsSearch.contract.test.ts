import request from 'supertest';

import { discogsScope } from '../helpers/nock';
import { createApp } from '../../src/app';
import { clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';

const app = createApp();

describe('Discogs search API contract: GET /api/discogs/search', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
  });

  it('returns mapped release results for an authenticated caller', async () => {
    const { idToken } = await getTestIdToken('search-user');

    discogsScope()
      .get('/database/search')
      .query({ q: 'Stockholm', type: 'release', page: '1', per_page: '50' })
      .reply(200, {
        pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
        results: [
          {
            id: 1,
            type: 'release',
            title: 'The Persuader - Stockholm',
            year: '1999',
            format: ['Vinyl'],
            thumb: '',
            cover_image: '',
            resource_url: 'https://api.discogs.com/releases/1',
          },
        ],
      });

    const res = await request(app)
      .get('/api/discogs/search')
      .query({ q: 'Stockholm', type: 'release' })
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      {
        discogsId: 1,
        resultType: 'release',
        title: 'The Persuader - Stockholm',
        year: 1999,
        formats: ['Vinyl'],
      },
    ]);
    expect(res.body.pagination).toEqual({ page: 1, pages: 1, items: 1, perPage: 50 });
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/discogs/search').query({ q: 'x', type: 'release' });

    expect(res.status).toBe(401);
  });

  it('returns 502 catalog_unavailable when Discogs is rate-limited', async () => {
    const { idToken } = await getTestIdToken('search-ratelimit-user');

    discogsScope().get('/database/search').query(true).reply(429, { message: 'too many requests' });

    const res = await request(app)
      .get('/api/discogs/search')
      .query({ q: 'x', type: 'release' })
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('catalog_unavailable');
  });

  it('returns 502 catalog_unavailable when Discogs is unreachable', async () => {
    const { idToken } = await getTestIdToken('search-network-user');

    discogsScope().get('/database/search').query(true).replyWithError('connection reset');

    const res = await request(app)
      .get('/api/discogs/search')
      .query({ q: 'x', type: 'release' })
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('catalog_unavailable');
  });
});

import RedisMock from 'ioredis-mock';
import request from 'supertest';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import { discogsScope } from '../helpers/nock';

import { createApp } from '../../src/app';
import { getRedisClient } from '../../src/cache/redisClient';
import { clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';

const app = createApp();

describe('Discogs routes stay available during a Redis outage (US2, SC-005)', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeAll(() => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  afterEach(async () => {
    await clearEmulatorUsers();
  });

  it('GET /api/discogs/search still returns 200 with the correct shape when Redis errors', async () => {
    jest.spyOn(getRedisClient()!, 'get').mockRejectedValueOnce(new Error('connection reset'));

    const { idToken } = await getTestIdToken('outage-search-user');

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
        title: 'Stockholm',
        artist: 'The Persuader',
        year: 1999,
        formats: ['Vinyl'],
      },
    ]);
  });

  it('GET /api/discogs/releases/:discogsId still returns 200 with the correct shape when Redis errors', async () => {
    jest.spyOn(getRedisClient()!, 'get').mockRejectedValueOnce(new Error('connection reset'));

    const { idToken } = await getTestIdToken('outage-release-user');

    discogsScope()
      .get('/releases/901')
      .reply(200, {
        id: 901,
        title: 'Stockholm',
        artists: [],
        labels: [],
        formats: [],
        genres: [],
        styles: [],
        tracklist: [],
        images: [],
        uri: 'https://www.discogs.com/release/901',
      });

    const res = await request(app)
      .get('/api/discogs/releases/901')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Stockholm');
  });
});

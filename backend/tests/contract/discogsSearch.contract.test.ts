import request from 'supertest';

import {
  discogsScope,
  rawSearchResultItem,
  stubReleaseRating,
  stubReleaseRatingNeverResolves,
  stubReleaseRatingUnavailable,
} from '../helpers/nock';
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
        title: 'Stockholm',
        artist: 'The Persuader',
        year: 1999,
        formats: ['Vinyl'],
      },
    ]);
    expect(res.body.pagination).toEqual({ page: 1, pages: 1, items: 1, perPage: 50 });
  });

  it('splits the artist out of a raw "Artist - Title" search result title', async () => {
    const { idToken } = await getTestIdToken('search-artist-split-user');

    discogsScope()
      .get('/database/search')
      .query({ q: 'Stockholm', type: 'release', page: '1', per_page: '50' })
      .reply(200, {
        pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
        results: [
          {
            id: 2,
            type: 'release',
            title: 'Miles Davis - Kind Of Blue',
            year: '1959',
            thumb: '',
            cover_image: '',
            resource_url: 'https://api.discogs.com/releases/2',
          },
        ],
      });

    const res = await request(app)
      .get('/api/discogs/search')
      .query({ q: 'Stockholm', type: 'release' })
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.body.results[0]).toEqual({
      discogsId: 2,
      resultType: 'release',
      title: 'Kind Of Blue',
      artist: 'Miles Davis',
      year: 1959,
    });
  });

  it('keeps the full title with no artist when no "Artist - Title" separator is present', async () => {
    const { idToken } = await getTestIdToken('search-no-artist-user');

    discogsScope()
      .get('/database/search')
      .query({ q: 'Untitled', type: 'release', page: '1', per_page: '50' })
      .reply(200, {
        pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
        results: [
          {
            id: 3,
            type: 'release',
            title: 'Untitled',
            thumb: '',
            cover_image: '',
            resource_url: 'https://api.discogs.com/releases/3',
          },
        ],
      });

    const res = await request(app)
      .get('/api/discogs/search')
      .query({ q: 'Untitled', type: 'release' })
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.body.results[0]).toEqual({
      discogsId: 3,
      resultType: 'release',
      title: 'Untitled',
    });
  });

  it('forwards page and perPage query params to the catalog search', async () => {
    const { idToken } = await getTestIdToken('search-pagination-user');

    discogsScope()
      .get('/database/search')
      .query({ q: 'love', type: 'release', page: '2', per_page: '10' })
      .reply(200, {
        pagination: { page: 2, pages: 5, items: 47, per_page: 10 },
        results: [],
      });

    const res = await request(app)
      .get('/api/discogs/search')
      .query({ q: 'love', type: 'release', page: '2', perPage: '10' })
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 2, pages: 5, items: 47, perPage: 10 });
  });

  it('defaults to page 1 when an invalid page value is sent', async () => {
    const { idToken } = await getTestIdToken('search-invalid-page-user');

    discogsScope()
      .get('/database/search')
      .query({ q: 'love', type: 'release', page: '1', per_page: '50' })
      .reply(200, { pagination: { page: 1, pages: 1, items: 0, per_page: 50 }, results: [] });

    const res = await request(app)
      .get('/api/discogs/search')
      .query({ q: 'love', type: 'release', page: 'not-a-number' })
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
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

  describe('additive communityRating enrichment (feature 017)', () => {
    it('includes an additive communityRating for a release with a valid rating', async () => {
      const { idToken } = await getTestIdToken('search-rating-user');

      discogsScope()
        .get('/database/search')
        .query({ q: 'Stockholm', type: 'release', page: '1', per_page: '50' })
        .reply(200, {
          pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
          results: [rawSearchResultItem({ id: 10 })],
        });
      stubReleaseRating(10, { average: 4.19, count: 47 });

      const res = await request(app)
        .get('/api/discogs/search')
        .query({ q: 'Stockholm', type: 'release' })
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.results[0].communityRating).toEqual({ average: 4.19, count: 47 });
    });

    it('omits communityRating when the release has no votes (count 0)', async () => {
      const { idToken } = await getTestIdToken('search-rating-unvoted-user');

      discogsScope()
        .get('/database/search')
        .query({ q: 'Stockholm', type: 'release', page: '1', per_page: '50' })
        .reply(200, {
          pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
          results: [rawSearchResultItem({ id: 11 })],
        });
      stubReleaseRating(11, { average: 0, count: 0 });

      const res = await request(app)
        .get('/api/discogs/search')
        .query({ q: 'Stockholm', type: 'release' })
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.results[0].communityRating).toBeUndefined();
    });

    it('omits communityRating and still returns 200 when a per-release rating lookup fails', async () => {
      const { idToken } = await getTestIdToken('search-rating-failure-user');

      discogsScope()
        .get('/database/search')
        .query({ q: 'Stockholm', type: 'release', page: '1', per_page: '50' })
        .reply(200, {
          pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
          results: [rawSearchResultItem({ id: 12 })],
        });
      stubReleaseRatingUnavailable(12);

      const res = await request(app)
        .get('/api/discogs/search')
        .query({ q: 'Stockholm', type: 'release' })
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.results[0].communityRating).toBeUndefined();
      expect(res.body.results[0].title).toBe('Stockholm');
    });

    it(
      'omits communityRating when a rating lookup exceeds the 2-second timeout (SC-006), without delaying the response',
      async () => {
        const { idToken } = await getTestIdToken('search-rating-timeout-user');

        discogsScope()
          .get('/database/search')
          .query({ q: 'Stockholm', type: 'release', page: '1', per_page: '50' })
          .reply(200, {
            pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
            results: [rawSearchResultItem({ id: 13 })],
          });
        stubReleaseRatingNeverResolves(13);

        const startedAt = Date.now();
        const res = await request(app)
          .get('/api/discogs/search')
          .query({ q: 'Stockholm', type: 'release' })
          .set('Authorization', `Bearer ${idToken}`);
        const elapsedMs = Date.now() - startedAt;

        expect(res.status).toBe(200);
        expect(res.body.results[0].communityRating).toBeUndefined();
        // The lookup timeout (2s) bounds the wait; the stub's artificial 2.5s
        // delay must not be allowed to stretch the overall response past it.
        expect(elapsedMs).toBeLessThan(2_400);
      },
      8_000,
    );
  });
});

import RedisMock from 'ioredis-mock';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import { discogsScope } from '../helpers/nock';

import { getRelease, searchCatalog } from '../../src/discogs/discogsClient';
import { enrichEntries } from '../../src/library/libraryEnrichment';
import type { LibraryEntry } from '../../src/library/types';

describe('Discogs response caching (US2)', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeAll(() => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  it('serves a second identical searchCatalog call from cache without a second Discogs request', async () => {
    discogsScope()
      .get('/database/search')
      .query({ q: 'Stockholm', page: '1', per_page: '50' })
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

    // Only one interceptor is registered above (nock.cleanAll() runs
    // afterEach) — a second outbound call here would hit no matching
    // interceptor and reject, so an equal second result proves the cache
    // (not a second HTTP call) served it.
    const first = await searchCatalog('Stockholm', { resultType: 'release' });
    const second = await searchCatalog('Stockholm', { resultType: 'release' });

    expect(second).toEqual(first);
  });

  it('serves a second identical getRelease call from cache without a second Discogs request', async () => {
    discogsScope().get('/releases/501').reply(200, {
      id: 501,
      title: 'Cached Release',
      artists: [],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      tracklist: [],
      images: [],
      uri: 'https://www.discogs.com/release/501',
    });

    const first = await getRelease(501);
    const second = await getRelease(501);

    expect(second).toEqual(first);
  });

  it('enriching two library entries that share a discogsReleaseId triggers only one outbound Discogs call', async () => {
    discogsScope().get('/releases/777').reply(200, {
      id: 777,
      title: 'Shared Release',
      artists: [],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      tracklist: [],
      images: [],
      uri: 'https://www.discogs.com/release/777',
    });

    const entries: LibraryEntry[] = [
      { id: 'a', discogsReleaseId: 777, addedAt: '2026-07-04T00:00:00.000Z' },
      { id: 'b', discogsReleaseId: 777, addedAt: '2026-07-04T00:00:00.000Z' },
    ];

    const enriched = await enrichEntries(entries);

    expect(enriched[0].catalogStatus).toBe('ok');
    expect(enriched[1].catalogStatus).toBe('ok');
    expect(enriched[0].release).toEqual(enriched[1].release);
  });
});

import RedisMock from 'ioredis-mock';
import request from 'supertest';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import {
  discogsScope,
  rawSearchResultItem,
  stubReleaseRatingUnavailable,
} from '../../helpers/nock';

import { createApp } from '../../../src/app';
import { getMasterRelease, getRelease } from '../../../src/adapters/discogsCatalog/discogsCatalogAdapter';
import { firestoreLibraryRepository } from '../../../src/adapters/library/firestoreLibraryRepository';
import { createEnrichLibraryEntryUseCase } from '../../../src/application/library/enrichLibraryEntry';
import type { LibraryEntry } from '../../../src/domain/library/types';
import { clearEmulatorUsers, getTestIdToken } from '../../helpers/authEmulator';

const app = createApp();
const { enrichEntry } = createEnrichLibraryEntryUseCase({
  repository: firestoreLibraryRepository,
});

function rawRelease(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Release ${id}`,
    artists: [],
    labels: [],
    formats: [],
    genres: [],
    styles: [],
    tracklist: [],
    images: [],
    uri: `https://www.discogs.com/release/${id}`,
    ...overrides,
  };
}

function libraryEntry(discogsReleaseId: number): LibraryEntry {
  return {
    id: `entry-${discogsReleaseId}`,
    discogsReleaseId,
    addedAt: '2026-01-01T00:00:00.000Z',
  };
}

function rawMaster(id: number) {
  return {
    id,
    title: `Master ${id}`,
    artists: [{ id: 1, name: 'Test Artist', anv: '', join: '', role: '' }],
    main_release: id * 10,
    uri: `https://www.discogs.com/master/${id}`,
  };
}

function rawMasterVersionsPage() {
  return {
    pagination: { page: 1, pages: 1, items: 0, per_page: 10 },
    versions: [],
  };
}

async function authHeader(uidHint: string): Promise<[string, string]> {
  const { idToken } = await getTestIdToken(uidHint);
  return ['Authorization', `Bearer ${idToken}`];
}

// getRedisClient() memoizes its result on first call. Set REDIS_URL here,
// before any test in this file makes its first withCache() call, so that
// first call doesn't permanently memoize "no client" for the rest of the
// file — which would silently defeat caching for the later describe blocks
// below that rely on it (e.g. the master cache-hit test).
const originalRedisUrl = process.env.REDIS_URL;

beforeAll(() => {
  process.env.REDIS_URL = 'redis://localhost:6379/0';
});

afterAll(() => {
  process.env.REDIS_URL = originalRedisUrl;
});

describe('Discogs retry resilience — background library enrichment scope (FR-009)', () => {
  it('recovers to catalogStatus "ok" when the underlying getRelease call fails once then succeeds', async () => {
    discogsScope().get('/releases/6001').reply(429, { message: 'too many requests' });
    discogsScope().get('/releases/6001').reply(200, rawRelease(6001));

    const enriched = await enrichEntry('retry-test-user', libraryEntry(6001));

    expect(enriched.catalogStatus).toBe('ok');
    expect(enriched.release?.discogsId).toBe(6001);
  });

  it('still degrades to catalogStatus "unavailable" once retries are fully exhausted', async () => {
    discogsScope().get('/releases/6002').times(3).reply(500, { message: 'server error' });

    const enriched = await enrichEntry('retry-test-user', libraryEntry(6002));

    expect(enriched.catalogStatus).toBe('unavailable');
    expect(enriched.release).toBeNull();
  }, 8_000);
});

describe('Discogs retry resilience — single retry per coalesced in-flight request (FR-007)', () => {
  it('serves two concurrent callers of the same uncached release with exactly one retry sequence', async () => {
    // Only two interceptors total: one 429 (the shared first attempt) and
    // one 200 (the shared retry). If retries were not coalesced with the
    // cache-aside single-flight map, a second, independent retry sequence
    // would need — and consume — two more interceptors that don't exist
    // here, and nock would reject the extra calls.
    const failScope = discogsScope()
      .get('/releases/6100')
      .reply(429, { message: 'too many requests' });
    const successScope = discogsScope().get('/releases/6100').reply(200, rawRelease(6100));

    const [first, second] = await Promise.all([getRelease(6100), getRelease(6100)]);

    expect(first).toEqual(second);
    expect(first.discogsId).toBe(6100);
    expect(failScope.isDone()).toBe(true);
    expect(successScope.isDone()).toBe(true);
  });
});

describe('Discogs retry resilience — master detail/versions routes (US1)', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
  });

  it('GET /api/discogs/masters/:discogsId recovers from a transient 429 and returns 200', async () => {
    discogsScope().get('/masters/7001').reply(429, { message: 'too many requests' });
    discogsScope().get('/masters/7001').reply(200, rawMaster(7001));
    const [header, value] = await authHeader('us1-master-recover');

    const res = await request(app)
      .get('/api/discogs/masters/7001')
      .set(header, value);

    expect(res.status).toBe(200);
    expect(res.body.discogsId).toBe(7001);
  });

  it('GET /api/discogs/masters/:discogsId/versions recovers from a transient 500 and returns 200', async () => {
    discogsScope()
      .get('/masters/7002/versions')
      .query(true)
      .reply(500, { message: 'server error' });
    discogsScope()
      .get('/masters/7002/versions')
      .query(true)
      .reply(200, rawMasterVersionsPage());
    const [header, value] = await authHeader('us1-versions-recover');

    const res = await request(app)
      .get('/api/discogs/masters/7002/versions')
      .set(header, value);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, pages: 1, items: 0, perPage: 10 });
  });

  it('GET /api/discogs/masters/:discogsId returns the unchanged 502 catalog_unavailable body after exhausting retries', async () => {
    discogsScope().get('/masters/7003').times(3).reply(500, { message: 'server error' });
    const [header, value] = await authHeader('us1-master-exhausted');

    const res = await request(app)
      .get('/api/discogs/masters/7003')
      .set(header, value);

    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      error: 'catalog_unavailable',
      message: 'The catalog service is temporarily unavailable. Please try again.',
    });
  }, 8_000);

  it('a cache hit for a master triggers zero outbound Discogs calls (no retry logic invoked)', async () => {
    discogsScope().get('/masters/7004').reply(200, rawMaster(7004));
    await getMasterRelease(7004); // populates the cache

    const [header, value] = await authHeader('us1-master-cache-hit');
    const res = await request(app)
      .get('/api/discogs/masters/7004')
      .set(header, value);

    expect(res.status).toBe(200);
    expect(res.body.discogsId).toBe(7004);
  });

  it('when the circuit breaker is already open, the route still returns the unchanged 502 catalog_unavailable body', async () => {
    for (let i = 0; i < 5; i += 1) {
      const id = 7100 + i;
      discogsScope().get(`/releases/${id}`).times(3).reply(500, { message: 'server error' });
      await expect(getRelease(id)).rejects.toThrow();
    }

    // No nock interceptor registered for 7999 — a real outbound attempt
    // would hit nock's "no match" guard instead of this mocked 502 shape.
    const [header, value] = await authHeader('us1-circuit-open');
    const res = await request(app)
      .get('/api/discogs/masters/7999')
      .set(header, value);

    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      error: 'catalog_unavailable',
      message: 'The catalog service is temporarily unavailable. Please try again.',
    });
  }, 20_000);
});

describe('Discogs retry resilience — search route (US2)', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
  });

  it('GET /api/discogs/search recovers from a transient 429 and returns 200 with results', async () => {
    discogsScope()
      .get('/database/search')
      .query({ q: 'Stockholm', page: '1', per_page: '50' })
      .reply(429, { message: 'too many requests' });
    discogsScope()
      .get('/database/search')
      .query({ q: 'Stockholm', page: '1', per_page: '50' })
      .reply(200, {
        pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
        results: [rawSearchResultItem({ id: 7200 })],
      });
    const [header, value] = await authHeader('us2-search-recover');

    const res = await request(app)
      .get('/api/discogs/search')
      .query({ q: 'Stockholm', type: 'release' })
      .set(header, value);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
  });

  it('a search that succeeds on the first attempt consumes exactly one outbound call (no added delay)', async () => {
    const scope = discogsScope()
      .get('/database/search')
      .query({ q: 'Aphex', page: '1', per_page: '50' })
      .reply(200, {
        pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
        results: [rawSearchResultItem({ id: 7201 })],
      });
    const [header, value] = await authHeader('us2-search-first-try');

    const res = await request(app)
      .get('/api/discogs/search')
      .query({ q: 'Aphex', type: 'release' })
      .set(header, value);

    expect(res.status).toBe(200);
    expect(scope.isDone()).toBe(true);
  });

  it('a failed community-rating lookup is still just omitted after exactly one call — never retried', async () => {
    discogsScope()
      .get('/database/search')
      .query({ q: 'Rating Scope', page: '1', per_page: '50' })
      .reply(200, {
        pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
        results: [rawSearchResultItem({ id: 7202 })],
      });
    const ratingScope = stubReleaseRatingUnavailable(7202);
    const [header, value] = await authHeader('us2-rating-scope');

    const res = await request(app)
      .get('/api/discogs/search')
      .query({ q: 'Rating Scope', type: 'release' })
      .set(header, value);

    expect(res.status).toBe(200);
    expect(res.body.results[0].communityRating).toBeUndefined();
    expect(ratingScope.isDone()).toBe(true);
  });
});

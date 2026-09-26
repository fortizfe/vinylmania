import RedisMock from 'ioredis-mock';

// A real cache backend is required by case 7 below (a second identical
// request inside the TTL must cost zero upstream calls) — `cacheAside`
// skips the cache entirely when no Redis is configured. Same pattern as
// tests/integration/discogsCatalog/discogsCaching.test.ts.
jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import request from 'supertest';

import { discogsScope } from '../../helpers/nock';

import { createApp } from '../../../src/app';
import { RATE_LIMIT_THRESHOLDS } from '../../../src/adapters/rateLimit/rateLimitOptions';
import { getFirestoreDb } from '../../../src/config/firebase-admin';
import { MAX_ATTEMPTS } from '../../../src/discogs/discogsRetry';
import { clearEmulatorUsers, clearEmulatorFirestore } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

/**
 * Feature 069, T015 — the 10 contract cases of
 * specs/069-header-search-redesign/contracts/suggest-api.md §7 for the new
 * `GET /api/discogs/suggest` (spec FR-010, FR-011, FR-016, FR-017, SC-011;
 * tasks assumptions 3 and 4).
 *
 * Every test uses its own `q`: the suggest cache is keyed by the normalised
 * query alone and shared across callers (research D5), so reusing another
 * test's query would be served from that test's cached payload.
 */

const app = createApp();

const OAUTH_TOKEN_HEADER = /oauth_token="access-token"/;

/** Seeds a Discogs connection doc as feature 015's completeLink would (spec 053). */
async function linkDiscogs(uid: string): Promise<void> {
  await getFirestoreDb()
    .collection('discogsConnections')
    .doc(uid)
    .set({
      uid,
      discogsUsername: `collector-${uid}`,
      discogsUserId: 42,
      accessToken: 'access-token',
      accessTokenSecret: 'access-secret',
      linkedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
}

function rawArtist(id: number, name: string) {
  return {
    id,
    type: 'artist',
    title: name,
    thumb: '',
    cover_image: `https://i.discogs.com/artist-${id}.jpg`,
    resource_url: `https://api.discogs.com/artists/${id}`,
  };
}

function rawAlbum(id: number, type: 'release' | 'master', title: string) {
  return {
    id,
    type,
    title,
    year: '1982',
    format: ['Vinyl', 'LP', 'Album'],
    thumb: '',
    cover_image: `https://i.discogs.com/album-${id}.jpg`,
    resource_url: `https://api.discogs.com/${type}s/${id}`,
  };
}

function rawArtists(count: number, firstId = 100): unknown[] {
  return Array.from({ length: count }, (_, i) => rawArtist(firstId + i, `Artist ${i}`));
}

function rawAlbums(count: number, firstId = 200): unknown[] {
  return Array.from({ length: count }, (_, i) =>
    rawAlbum(firstId + i, i % 2 === 0 ? 'release' : 'master', `Performer ${i} - Album ${i}`),
  );
}

interface UpstreamSearchStub {
  /** The query params of every `/database/search` request that actually reached the stub. */
  calls: Array<Record<string, string>>;
}

/**
 * Stubs `/database/search`. Registers more interceptors than the contract
 * allows (`times: 3`) on purpose: a second upstream call then shows up as
 * `calls.length === 2` instead of as an unrelated 502.
 */
function stubUpstreamSearch(results: unknown[]): UpstreamSearchStub {
  const calls: Array<Record<string, string>> = [];
  discogsScope()
    .get('/database/search')
    .query((actual) => {
      calls.push(actual as Record<string, string>);
      return true;
    })
    .times(3)
    .reply(200, {
      pagination: { page: 1, pages: 1, items: results.length, per_page: 20 },
      results,
    });
  return { calls };
}

/**
 * Interceptors for the rating fan-out `/api/discogs/search` performs. None
 * of them may be consumed on this path (contracts §4, SC-011) — an unused
 * interceptor leaves `isDone()` false.
 */
function stubRatingFanout(): {
  ratingScope: ReturnType<typeof discogsScope>;
  masterScope: ReturnType<typeof discogsScope>;
} {
  const ratingScope = discogsScope()
    .get(/\/releases\/\d+\/rating$/)
    .reply(200, { release_id: 1, rating: { average: 4.5, count: 812 } });
  const masterScope = discogsScope()
    .get(/\/masters\/\d+$/)
    .reply(200, {
      id: 1,
      title: 'Never Fetched',
      artists: [],
      main_release: 1,
      uri: 'https://www.discogs.com/master/1',
    });
  return { ratingScope, masterScope };
}

async function getSuggestions(
  uid: string,
  q: string,
): Promise<{ status: number; body: { suggestions?: unknown[]; [key: string]: unknown } }> {
  const { sessionToken } = await createTestSession(uid);
  const res = await request(app)
    .get('/api/discogs/suggest')
    .query({ q })
    .set('Authorization', `Bearer ${sessionToken}`);
  return { status: res.status, body: res.body };
}

describe('Discogs suggest API contract: GET /api/discogs/suggest', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeAll(() => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  // Case 1 — shape (contracts §2, data-model §2)
  it('returns at most 5 suggestions in the documented shape, with no rating, no pagination and no echo of q', async () => {
    stubUpstreamSearch([
      rawArtist(251595, 'Iron Maiden'),
      rawAlbum(1198042, 'master', 'Iron Maiden - The Number Of The Beast'),
    ]);

    const { status, body } = await getSuggestions('suggest-shape-user', 'Shape Query');

    expect(status).toBe(200);
    expect(Object.keys(body)).toEqual(['suggestions']);
    expect(body.suggestions).toEqual([
      {
        discogsId: 251595,
        resultType: 'artist',
        title: 'Iron Maiden',
        thumbnailUrl: 'https://i.discogs.com/artist-251595.jpg',
      },
      {
        discogsId: 1198042,
        resultType: 'master',
        title: 'The Number Of The Beast',
        artist: 'Iron Maiden',
        year: 1982,
        // The first format only — the panel has one line for it.
        format: 'Vinyl',
        thumbnailUrl: 'https://i.discogs.com/album-1198042.jpg',
      },
    ]);
  });

  // Case 2 — exactly one upstream call, no type param, per_page=20 (SC-011, assumption 3)
  it('makes exactly one /database/search request, with no type param and per_page=20', async () => {
    const upstream = stubUpstreamSearch(rawAlbums(3));

    const { status } = await getSuggestions('suggest-one-call-user', 'One Call Query');

    expect(status).toBe(200);
    expect(upstream.calls).toHaveLength(1);
    expect(upstream.calls[0]).toEqual({ q: 'One Call Query', page: '1', per_page: '20' });
  });

  // Case 3 — no rating enrichment (contracts §4, FR-017)
  it('makes no rating and no master lookups', async () => {
    stubUpstreamSearch([
      rawAlbum(301, 'release', 'Performer - A Release'),
      rawAlbum(302, 'master', 'Performer - A Master'),
    ]);
    const { ratingScope, masterScope } = stubRatingFanout();

    const { status, body } = await getSuggestions('suggest-no-ratings-user', 'No Ratings Query');

    expect(status).toBe(200);
    expect(body.suggestions).toHaveLength(2);
    expect(ratingScope.isDone()).toBe(false);
    expect(masterScope.isDone()).toBe(false);
  });

  // Case 4 — below 2 non-whitespace characters (contracts §2, FR-010)
  it.each<[string, string]>([
    ['a single character', 'i'],
    ['whitespace only', '  '],
  ])('returns an empty list with no upstream request for %s', async (_label, q) => {
    const upstream = stubUpstreamSearch(rawAlbums(3));

    const { status, body } = await getSuggestions(
      `suggest-short-${encodeURIComponent(q)}-user`,
      q,
    );

    expect(status).toBe(200);
    expect(body).toEqual({ suggestions: [] });
    expect(upstream.calls).toHaveLength(0);
  });

  // Case 5 — the quota (data-model §3, FR-011, SC-011, assumption 4)
  it('allocates 4 artists + 9 albums as 2 artists then 3 albums', async () => {
    stubUpstreamSearch([...rawArtists(4, 400), ...rawAlbums(9, 450)]);

    const { status, body } = await getSuggestions('suggest-quota-mixed-user', 'Quota Mixed Query');

    expect(status).toBe(200);
    expect((body.suggestions as Array<{ resultType: string }>).map((s) => s.resultType)).toEqual([
      'artist',
      'artist',
      'release',
      'master',
      'release',
    ]);
    expect((body.suggestions as Array<{ discogsId: number }>).map((s) => s.discogsId)).toEqual([
      400, 401, 450, 451, 452,
    ]);
  });

  it('allocates 0 artists + 9 albums as 5 albums', async () => {
    stubUpstreamSearch(rawAlbums(9, 550));

    const { status, body } = await getSuggestions(
      'suggest-quota-albums-user',
      'Quota Albums Query',
    );

    expect(status).toBe(200);
    expect((body.suggestions as Array<{ discogsId: number }>).map((s) => s.discogsId)).toEqual([
      550, 551, 552, 553, 554,
    ]);
  });

  it('allocates 6 artists + 1 album as 4 artists then 1 album', async () => {
    stubUpstreamSearch([...rawArtists(6, 600), ...rawAlbums(1, 650)]);

    const { status, body } = await getSuggestions(
      'suggest-quota-artists-user',
      'Quota Artists Query',
    );

    expect(status).toBe(200);
    expect((body.suggestions as Array<{ resultType: string }>).map((s) => s.resultType)).toEqual([
      'artist',
      'artist',
      'artist',
      'artist',
      'release',
    ]);
    expect((body.suggestions as Array<{ discogsId: number }>).map((s) => s.discogsId)).toEqual([
      600, 601, 602, 603, 650,
    ]);
  });

  // Case 6 — an unexpected raw type degrades to "not included" (contracts §5)
  it('drops a label-typed raw hit without failing the response', async () => {
    stubUpstreamSearch([
      {
        id: 701,
        type: 'label',
        title: 'Warner Bros. Records',
        resource_url: 'https://api.discogs.com/labels/701',
      },
      rawArtist(702, 'Warner Sisters'),
      rawAlbum(703, 'release', 'Warner Sisters - Debut'),
    ]);

    const { status, body } = await getSuggestions('suggest-label-user', 'Label Drop Query');

    expect(status).toBe(200);
    expect((body.suggestions as Array<{ discogsId: number }>).map((s) => s.discogsId)).toEqual([
      702, 703,
    ]);
  });

  // Case 7 — the 5-minute cache (FR-017, research D5)
  it('serves a second identical request inside the TTL from cache, with no further upstream request', async () => {
    const upstream = stubUpstreamSearch([...rawArtists(2, 800), ...rawAlbums(3, 850)]);

    const first = await getSuggestions('suggest-cache-first-user', 'Cache Hit Query');
    const second = await getSuggestions('suggest-cache-second-user', 'Cache Hit Query');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(upstream.calls).toHaveLength(1);
  });

  // Case 8 — upstream failures (contracts §3)
  it('returns 502 catalog_unavailable when Discogs is rate-limited', async () => {
    discogsScope()
      .get('/database/search')
      .query(true)
      .times(MAX_ATTEMPTS)
      .reply(429, { message: 'too many requests' });

    const { status, body } = await getSuggestions('suggest-429-user', 'Rate Limited Query');

    expect(status).toBe(502);
    expect(body).toEqual({
      error: 'catalog_unavailable',
      message: 'The catalog service is temporarily unavailable. Please try again.',
    });
  });

  it('returns 502 catalog_unavailable when Discogs is unreachable', async () => {
    discogsScope()
      .get('/database/search')
      .query(true)
      .times(MAX_ATTEMPTS)
      .replyWithError('connection reset');

    const { status, body } = await getSuggestions('suggest-unavailable-user', 'Unreachable Query');

    expect(status).toBe(502);
    expect(body.error).toBe('catalog_unavailable');
  });

  it('returns 500 internal_error on an unexpected failure', async () => {
    // A malformed hit fails the mapper's schema (DiscogsValidationError) —
    // neither an auth, a rate-limit nor an availability failure, so it must
    // land in the route's catch-all branch.
    stubUpstreamSearch([{ id: 'not-a-number', type: 'release', title: 'Malformed' }]);

    const { status, body } = await getSuggestions('suggest-500-user', 'Malformed Query');

    expect(status).toBe(500);
    expect(body).toEqual({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  });

  // Case 9 — a rejected linked credential (contracts §3, spec 053 parity)
  it('returns 401 discogs_link_invalid, byte-identical to /api/discogs/search, when the linked account is rejected', async () => {
    const { sessionToken, uid } = await createTestSession('suggest-revoked-user');
    await linkDiscogs(uid);
    discogsScope()
      .get('/database/search')
      .query(true)
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(401, { message: 'unauthorized' });

    const res = await request(app)
      .get('/api/discogs/suggest')
      .query({ q: 'Revoked Suggest Query' })
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'discogs_link_invalid',
      message:
        'Your Discogs link is no longer valid. Please re-link your account from your profile.',
    });
  });

  // Case 10 — auth and the route's own rate-limit bucket (contracts §1, §3, research D6)
  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/discogs/suggest').query({ q: 'Unauthenticated' });

    expect(res.status).toBe(401);
  });

  it('returns 429 rate_limited over its own bucket, without consuming /api/discogs/search budget', async () => {
    // The limiter runs before requireAuth (contracts §1), so an
    // unauthenticated burst is enough to exhaust the bucket and costs no
    // emulator or upstream work.
    let last = { status: 0, body: {} as Record<string, unknown> };
    for (let i = 0; i <= RATE_LIMIT_THRESHOLDS.standard; i += 1) {
      const res = await request(app).get('/api/discogs/suggest').query({ q: 'Burst Query' });
      last = { status: res.status, body: res.body as Record<string, unknown> };
    }

    expect(last.status).toBe(429);
    expect(last.body).toEqual({
      error: 'rate_limited',
      message: 'Too many requests. Please try again shortly.',
    });

    // /api/discogs/search keeps its own budget: it is still served.
    const { sessionToken } = await createTestSession('suggest-budget-guard-user');
    discogsScope()
      .get('/database/search')
      .query(true)
      .reply(200, { pagination: { page: 1, pages: 1, items: 0, per_page: 50 }, results: [] });

    const searchRes = await request(app)
      .get('/api/discogs/search')
      .query({ q: 'Budget Guard Query', type: 'release' })
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(searchRes.status).toBe(200);
  }, 60_000);
});

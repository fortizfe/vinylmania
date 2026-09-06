import RedisMock from 'ioredis-mock';
import request from 'supertest';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import {
  discogsScope,
  rawCollectionInstance,
  stubCollectionFields,
} from '../../helpers/nock';
import { createApp } from '../../../src/app';
import { getRedisClient } from '../../../src/adapters/cache/redisClient';
import { getFirestoreDb } from '../../../src/config/firebase-admin';
import { MAX_ATTEMPTS } from '../../../src/discogs/discogsRetry';
import { clearEmulatorFirestore, clearEmulatorUsers } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

const app = createApp();

const rawRelease = (id: number) => ({
  id,
  title: `Release ${id}`,
  year: 1999,
  artists: [{ id: 1, name: 'Artist', anv: '', join: '', role: '' }],
  labels: [],
  formats: [],
  genres: [],
  styles: [],
  tracklist: [],
  images: [],
  uri: `https://www.discogs.com/release/${id}`,
});

interface RawWantOverrides {
  rating?: number;
  notes?: string;
  dateAdded?: string;
}

function rawWant(releaseId: number, overrides: RawWantOverrides = {}) {
  return {
    id: releaseId,
    rating: overrides.rating ?? 0,
    notes: overrides.notes ?? '',
    date_added: overrides.dateAdded ?? '2025-08-01T12:00:00-07:00',
    basic_information: {
      id: releaseId,
      title: `Release ${releaseId}`,
      year: 1979,
      artists: [{ name: 'The Artist' }],
      thumb: `https://img/${releaseId}.jpg`,
    },
  };
}

function stubWantsPage(
  username: string,
  wants: ReturnType<typeof rawWant>[],
  { page = 1, pages = 1 }: { page?: number; pages?: number } = {},
) {
  return discogsScope()
    .get(`/users/${username}/wants`)
    .query((query) => Number(query.page ?? 1) === page)
    .reply(200, {
      pagination: { page, pages, per_page: 100, items: wants.length },
      wants,
    });
}

beforeAll(() => {
  process.env.REDIS_URL = 'redis://localhost:6379/0';
});

afterEach(async () => {
  await getRedisClient()!.flushall();
  await clearEmulatorUsers();
  await clearEmulatorFirestore();
});

async function linkDiscogs(uid: string): Promise<string> {
  const username = `collector-${uid}`;
  await getFirestoreDb()
    .collection('discogsConnections')
    .doc(uid)
    .set({
      uid,
      discogsUsername: username,
      discogsUserId: 42,
      accessToken: 'access-token',
      accessTokenSecret: 'access-secret',
      linkedAt: new Date('2026-07-01T00:00:00.000Z'),
      initialLibrarySyncAt: new Date('2026-07-02T00:00:00.000Z'),
    });
  return username;
}

describe('GET /api/wantlist: gating', () => {
  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/wantlist');
    expect(res.status).toBe(401);
  });

  it('returns 409 discogs_not_linked (message mentions the wishlist) without a connection', async () => {
    const { sessionToken } = await createTestSession('wl-unlinked-user');

    const res = await request(app)
      .get('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('discogs_not_linked');
    expect(res.body.message).toMatch(/wishlist/i);
  });

  it('returns 401 discogs_link_invalid when Discogs rejects the stored credentials', async () => {
    const { sessionToken, uid } = await createTestSession('wl-revoked-user');
    const username = await linkDiscogs(uid);

    discogsScope()
      .get(`/users/${username}/wants`)
      .query(true)
      .reply(401, { message: 'auth' });

    const res = await request(app)
      .get('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('discogs_link_invalid');
  });

  it('returns 429 discogs_rate_limited on a sustained 429', async () => {
    const { sessionToken, uid } = await createTestSession('wl-ratelimited-user');
    const username = await linkDiscogs(uid);

    discogsScope()
      .get(`/users/${username}/wants`)
      .query(true)
      .times(MAX_ATTEMPTS)
      .reply(429, { message: 'Too many requests' });

    const res = await request(app)
      .get('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('discogs_rate_limited');
  }, 10_000);

  it('returns 503 discogs_unavailable on a sustained 5xx', async () => {
    const { sessionToken, uid } = await createTestSession('wl-unavailable-user');
    const username = await linkDiscogs(uid);

    discogsScope()
      .get(`/users/${username}/wants`)
      .query(true)
      .times(MAX_ATTEMPTS)
      .reply(500, { message: 'boom' });

    const res = await request(app)
      .get('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('discogs_unavailable');
  }, 10_000);
});

describe('GET /api/wantlist: listing', () => {
  it('returns the synchronized wantlist newest-first with totalItems as the full size', async () => {
    const { sessionToken, uid } = await createTestSession('wl-list-user');
    const username = await linkDiscogs(uid);

    stubWantsPage(username, [
      rawWant(1, { dateAdded: '2025-01-01T00:00:00-00:00' }),
      rawWant(2, { dateAdded: '2025-08-01T00:00:00-00:00' }),
      rawWant(3, { dateAdded: '2025-05-01T00:00:00-00:00' }),
    ]);
    discogsScope().get('/releases/1').reply(200, rawRelease(1));
    discogsScope().get('/releases/2').reply(200, rawRelease(2));
    discogsScope().get('/releases/3').reply(200, rawRelease(3));

    const res = await request(app)
      .get('/api/wantlist')
      .query({ pageSize: 2 })
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 2, totalItems: 3 });
    expect(res.body.items).toHaveLength(2);
    expect(
      res.body.items.map((i: { discogsReleaseId: number }) => i.discogsReleaseId),
    ).toEqual([2, 3]);
    expect(res.body.items[0]).toMatchObject({ catalogStatus: 'ok' });
  });

  it('returns an empty wantlist as items:[] with totalItems:0', async () => {
    const { sessionToken, uid } = await createTestSession('wl-empty-user');
    const username = await linkDiscogs(uid);

    stubWantsPage(username, []);

    const res = await request(app)
      .get('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, totalItems: 0 });
  });

  it('serves a second load from cache without contacting Discogs, and refresh=true forces a fresh sync', async () => {
    const { sessionToken, uid } = await createTestSession('wl-refresh-user');
    const username = await linkDiscogs(uid);

    stubWantsPage(username, [rawWant(1, { dateAdded: '2025-08-01T00:00:00-00:00' })]);
    discogsScope().get('/releases/1').reply(200, rawRelease(1));

    const first = await request(app)
      .get('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(first.body.totalItems).toBe(1);
    expect(await getRedisClient()!.get(`discogs:wantlist:${uid}`)).not.toBeNull();

    // No stubs remain: a second sync attempt would fail loudly.
    const second = await request(app)
      .get('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(second.status).toBe(200);
    expect(second.body.totalItems).toBe(1);

    // A want was added on discogs.com; refresh=true invalidates + re-fetches.
    stubWantsPage(username, [
      rawWant(1, { dateAdded: '2025-08-01T00:00:00-00:00' }),
      rawWant(2, { dateAdded: '2025-09-01T00:00:00-00:00' }),
    ]);
    discogsScope().get('/releases/1').reply(200, rawRelease(1));
    discogsScope().get('/releases/2').reply(200, rawRelease(2));

    const refreshed = await request(app)
      .get('/api/wantlist')
      .query({ refresh: 'true' })
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.totalItems).toBe(2);
  });
});

describe('POST /api/wantlist: body validation', () => {
  it('returns 400 invalid_request when discogsReleaseId is missing', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-missing-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('returns 400 invalid_request when discogsReleaseId is not a number', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-nan-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('returns 400 invalid_request when the body carries extra keys', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-extra-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 1, notes: 'nope' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });
});

describe('POST /api/wantlist: add', () => {
  function stubCatalogRelease(releaseId: number) {
    return discogsScope().get(`/releases/${releaseId}`).reply(200, rawRelease(releaseId));
  }

  it('creates the want and returns 201 with the advisory flags (not in wantlist, not in library)', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-ok-user');
    const username = await linkDiscogs(uid);

    stubCatalogRelease(1);
    stubWantsPage(username, []);
    const putWant = discogsScope()
      .put(`/users/${username}/wants/1`)
      .reply(200, rawWant(1, { dateAdded: '2026-09-06T12:00:00.000Z' }));
    stubCollectionFields(username);
    discogsScope()
      .get(`/users/${username}/collection/releases/1`)
      .reply(200, { releases: [] });

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(201);
    expect(putWant.isDone()).toBe(true);
    expect(res.body).toMatchObject({
      discogsReleaseId: 1,
      catalogStatus: 'ok',
      alreadyInWantlist: false,
      alreadyInLibrary: false,
    });
    expect(res.body.release).not.toBeNull();
  });

  it('is idempotent: an existing want returns 201 alreadyInWantlist:true and issues no PUT', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-dup-user');
    const username = await linkDiscogs(uid);

    stubCatalogRelease(1);
    stubWantsPage(username, [
      rawWant(1, { rating: 4, notes: 'Original pressing only' }),
    ]);
    stubCollectionFields(username);
    discogsScope()
      .get(`/users/${username}/collection/releases/1`)
      .reply(200, { releases: [] });

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      discogsReleaseId: 1,
      rating: 4,
      notes: 'Original pressing only',
      alreadyInWantlist: true,
      alreadyInLibrary: false,
    });
  });

  it('sets alreadyInLibrary:true when the caller already owns the release', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-owned-user');
    const username = await linkDiscogs(uid);

    stubCatalogRelease(1);
    stubWantsPage(username, []);
    discogsScope().put(`/users/${username}/wants/1`).reply(200, rawWant(1));
    stubCollectionFields(username);
    discogsScope()
      .get(`/users/${username}/collection/releases/1`)
      .reply(200, { releases: [rawCollectionInstance(1)] });

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.alreadyInLibrary).toBe(true);
  });

  it('busts the discogs:wantlist cache so the next GET re-syncs', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-bust-user');
    const username = await linkDiscogs(uid);

    // Warm the list cache.
    discogsScope()
      .get(`/users/${username}/wants`)
      .query(true)
      .reply(200, {
        pagination: { page: 1, pages: 1, per_page: 100, items: 0 },
        wants: [],
      });
    await request(app)
      .get('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(await getRedisClient()!.get(`discogs:wantlist:${uid}`)).not.toBeNull();

    stubCatalogRelease(1);
    stubWantsPage(username, []);
    discogsScope().put(`/users/${username}/wants/1`).reply(200, rawWant(1));
    stubCollectionFields(username);
    discogsScope()
      .get(`/users/${username}/collection/releases/1`)
      .reply(200, { releases: [] });

    await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 1 });

    expect(await getRedisClient()!.get(`discogs:wantlist:${uid}`)).toBeNull();
  });

  it('returns 404 release_not_found and writes nothing when the catalog lookup 404s', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-notfound-user');
    await linkDiscogs(uid);
    discogsScope().get('/releases/999999999').reply(404, { message: 'not found' });

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 999999999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('release_not_found');
  });

  it('returns 502 catalog_unavailable when the gating catalog lookup fails', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-catalog-down-user');
    await linkDiscogs(uid);
    discogsScope().get('/releases/1').times(MAX_ATTEMPTS).reply(503, { message: 'boom' });

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('catalog_unavailable');
  }, 10_000);

  it('returns 409 discogs_not_linked without a connection', async () => {
    const { sessionToken } = await createTestSession('wl-add-unlinked-user');

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('discogs_not_linked');
  });

  it('returns 401 discogs_link_invalid when Discogs rejects the stored credentials', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-revoked-user');
    const username = await linkDiscogs(uid);

    stubCatalogRelease(1);
    discogsScope()
      .get(`/users/${username}/wants`)
      .query(true)
      .reply(401, { message: 'auth' });

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('discogs_link_invalid');
  });

  it('returns 429 discogs_rate_limited on a sustained 429 from the wants write path', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-ratelimited-user');
    const username = await linkDiscogs(uid);

    stubCatalogRelease(1);
    discogsScope()
      .get(`/users/${username}/wants`)
      .query(true)
      .times(MAX_ATTEMPTS)
      .reply(429, { message: 'Too many requests' });

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('discogs_rate_limited');
  }, 10_000);

  it('returns 503 discogs_unavailable on a sustained 5xx from the wants path', async () => {
    const { sessionToken, uid } = await createTestSession('wl-add-unavailable-user');
    const username = await linkDiscogs(uid);

    stubCatalogRelease(1);
    discogsScope()
      .get(`/users/${username}/wants`)
      .query(true)
      .times(MAX_ATTEMPTS)
      .reply(500, { message: 'boom' });

    const res = await request(app)
      .post('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('discogs_unavailable');
  }, 10_000);
});

function stubWantLookup(
  username: string,
  _releaseId: number,
  result: { status: number; body?: unknown },
) {
  // `getWant` is derived from `GET /users/{username}/wants` — Discogs has no
  // single-want endpoint. A 200 places the release in the list; a 404
  // ("not a want") is an empty list; any other status surfaces verbatim.
  const scope = discogsScope().get(`/users/${username}/wants`).query(true);
  if (result.status === 200) {
    return scope.reply(200, {
      pagination: { page: 1, pages: 1, per_page: 100, items: 1 },
      wants: [result.body],
    });
  }
  if (result.status === 404) {
    return scope.reply(200, {
      pagination: { page: 1, pages: 1, per_page: 100, items: 0 },
      wants: [],
    });
  }
  return scope.reply(result.status, result.body ?? {});
}

describe('GET /api/wantlist/:releaseId', () => {
  it('returns 200 with the WantEntryDetail shape when the release is a want', async () => {
    const { sessionToken, uid } = await createTestSession('wl-get-one-user');
    const username = await linkDiscogs(uid);

    stubWantLookup(username, 7, {
      status: 200,
      body: rawWant(7, {
        rating: 4,
        notes: 'Original pressing only',
        dateAdded: '2025-08-01T19:00:00.000Z',
      }),
    });

    const res = await request(app)
      .get('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      discogsReleaseId: 7,
      rating: 4,
      notes: 'Original pressing only',
      addedAt: '2025-08-01T19:00:00.000Z',
    });
  });

  it('returns 404 not_in_wantlist when the release is not a want', async () => {
    const { sessionToken, uid } = await createTestSession('wl-get-one-missing-user');
    const username = await linkDiscogs(uid);

    stubWantLookup(username, 7, { status: 404, body: { message: 'not found' } });

    const res = await request(app)
      .get('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_in_wantlist');
    expect(res.body.message).toMatch(/wishlist/i);
  });

  it('returns 400 invalid_request on a non-numeric :releaseId', async () => {
    const { sessionToken, uid } = await createTestSession('wl-get-one-nan-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .get('/api/wantlist/not-a-number')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('returns 409 discogs_not_linked without a connection', async () => {
    const { sessionToken } = await createTestSession('wl-get-one-unlinked-user');

    const res = await request(app)
      .get('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('discogs_not_linked');
  });

  it('returns 401 discogs_link_invalid when Discogs rejects the stored credentials', async () => {
    const { sessionToken, uid } = await createTestSession('wl-get-one-revoked-user');
    const username = await linkDiscogs(uid);

    stubWantLookup(username, 7, { status: 401, body: { message: 'auth' } });

    const res = await request(app)
      .get('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('discogs_link_invalid');
  });

  it('serves from the warm discogs:wantlist cache without a fresh wants request', async () => {
    const { sessionToken, uid } = await createTestSession('wl-get-one-cached-user');
    const username = await linkDiscogs(uid);

    stubWantsPage(username, [
      rawWant(7, { rating: 2, dateAdded: '2025-08-01T00:00:00-00:00' }),
    ]);
    discogsScope().get('/releases/7').reply(200, rawRelease(7));

    // Warm the list cache.
    await request(app)
      .get('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(await getRedisClient()!.get(`discogs:wantlist:${uid}`)).not.toBeNull();

    // No wants/7 stub registered: a fresh lookup would fail loudly.
    const res = await request(app)
      .get('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ discogsReleaseId: 7, rating: 2 });
  });
});

describe('PATCH /api/wantlist/:releaseId', () => {
  function stubWantPut(
    username: string,
    releaseId: number,
    body: ReturnType<typeof rawWant>,
  ) {
    return discogsScope().put(`/users/${username}/wants/${releaseId}`).reply(200, body);
  }

  it('returns 200 with the updated detail after a rating change', async () => {
    const { sessionToken, uid } = await createTestSession('wl-patch-ok-user');
    const username = await linkDiscogs(uid);

    stubWantLookup(username, 7, { status: 200, body: rawWant(7) });
    const put = stubWantPut(
      username,
      7,
      rawWant(7, { rating: 5, dateAdded: '2025-08-01T19:00:00.000Z' }),
    );

    const res = await request(app)
      .patch('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ rating: 5 });

    expect(res.status).toBe(200);
    expect(put.isDone()).toBe(true);
    expect(res.body).toEqual({
      discogsReleaseId: 7,
      rating: 5,
      notes: null,
      addedAt: '2025-08-01T19:00:00.000Z',
    });
  });

  it('accepts an empty-string note to clear the field', async () => {
    const { sessionToken, uid } = await createTestSession('wl-patch-clear-user');
    const username = await linkDiscogs(uid);

    stubWantLookup(username, 7, { status: 200, body: rawWant(7, { notes: 'old note' }) });
    stubWantPut(username, 7, rawWant(7, { notes: '' }));

    const res = await request(app)
      .patch('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ notes: '' });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBeNull();
  });

  it('busts the discogs:wantlist cache', async () => {
    const { sessionToken, uid } = await createTestSession('wl-patch-bust-user');
    const username = await linkDiscogs(uid);

    stubWantsPage(username, [rawWant(7, { dateAdded: '2025-08-01T00:00:00-00:00' })]);
    discogsScope().get('/releases/7').reply(200, rawRelease(7));
    await request(app)
      .get('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(await getRedisClient()!.get(`discogs:wantlist:${uid}`)).not.toBeNull();

    // The warm cache satisfies the existence check; only the PUT hits Discogs.
    stubWantPut(username, 7, rawWant(7, { rating: 3 }));

    await request(app)
      .patch('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ rating: 3 });

    expect(await getRedisClient()!.get(`discogs:wantlist:${uid}`)).toBeNull();
  });

  it('rejects an empty body with 400 invalid_request', async () => {
    const { sessionToken, uid } = await createTestSession('wl-patch-empty-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .patch('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('rejects unknown keys with 400 invalid_request', async () => {
    const { sessionToken, uid } = await createTestSession('wl-patch-extra-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .patch('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ rating: 3, colour: 'red' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('rejects a rating outside 0..5 with 400 invalid_request', async () => {
    const { sessionToken, uid } = await createTestSession('wl-patch-range-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .patch('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ rating: 9 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('returns 400 invalid_request on a non-numeric :releaseId', async () => {
    const { sessionToken, uid } = await createTestSession('wl-patch-nan-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .patch('/api/wantlist/not-a-number')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ rating: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('returns 404 not_in_wantlist when the release is not a want', async () => {
    const { sessionToken, uid } = await createTestSession('wl-patch-missing-user');
    const username = await linkDiscogs(uid);

    stubWantLookup(username, 7, { status: 404, body: { message: 'not found' } });

    const res = await request(app)
      .patch('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ rating: 3 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_in_wantlist');
  });

  it('returns 409 discogs_not_linked without a connection', async () => {
    const { sessionToken } = await createTestSession('wl-patch-unlinked-user');

    const res = await request(app)
      .patch('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ rating: 3 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('discogs_not_linked');
  });

  it('returns 429 discogs_rate_limited on a sustained 429 from the wants path', async () => {
    const { sessionToken, uid } = await createTestSession('wl-patch-ratelimited-user');
    const username = await linkDiscogs(uid);

    discogsScope()
      .get(`/users/${username}/wants`)
      .query(true)
      .times(MAX_ATTEMPTS)
      .reply(429, { message: 'Too many requests' });

    const res = await request(app)
      .patch('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ rating: 3 });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('discogs_rate_limited');
  }, 10_000);

  it('does NOT report the entry as saved when the Discogs write fails (FR-017)', async () => {
    const { sessionToken, uid } = await createTestSession('wl-patch-writefail-user');
    const username = await linkDiscogs(uid);

    stubWantLookup(username, 7, { status: 200, body: rawWant(7) });
    discogsScope().put(`/users/${username}/wants/7`).reply(500, { message: 'boom' });

    const res = await request(app)
      .patch('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ rating: 3 });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('discogs_unavailable');
    expect(await getRedisClient()!.get(`discogs:wantlist:${uid}`)).toBeNull();
  });
});

describe('DELETE /api/wantlist/:releaseId', () => {
  it('returns 204 with an empty body and busts the cache on a successful removal', async () => {
    const { sessionToken, uid } = await createTestSession('wl-del-ok-user');
    const username = await linkDiscogs(uid);

    stubWantsPage(username, []);
    await request(app)
      .get('/api/wantlist')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(await getRedisClient()!.get(`discogs:wantlist:${uid}`)).not.toBeNull();

    const del = discogsScope().delete(`/users/${username}/wants/7`).reply(204);

    const res = await request(app)
      .delete('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(del.isDone()).toBe(true);
    expect(await getRedisClient()!.get(`discogs:wantlist:${uid}`)).toBeNull();
  });

  it('returns 404 not_in_wantlist when Discogs reports the release is not a want', async () => {
    const { sessionToken, uid } = await createTestSession('wl-del-missing-user');
    const username = await linkDiscogs(uid);

    discogsScope()
      .delete(`/users/${username}/wants/7`)
      .reply(404, { message: 'not found' });

    const res = await request(app)
      .delete('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'not_in_wantlist',
      message: 'This release is not in your wishlist.',
    });
  });

  it('returns 400 invalid_request on a non-numeric :releaseId', async () => {
    const { sessionToken, uid } = await createTestSession('wl-del-nan-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .delete('/api/wantlist/not-a-number')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('returns 409 discogs_not_linked without a connection', async () => {
    const { sessionToken } = await createTestSession('wl-del-unlinked-user');

    const res = await request(app)
      .delete('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('discogs_not_linked');
  });

  it('returns 401 discogs_link_invalid when Discogs rejects the stored credentials', async () => {
    const { sessionToken, uid } = await createTestSession('wl-del-revoked-user');
    const username = await linkDiscogs(uid);

    discogsScope().delete(`/users/${username}/wants/7`).reply(401, { message: 'auth' });

    const res = await request(app)
      .delete('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('discogs_link_invalid');
  });

  it('returns 429 discogs_rate_limited on a 429 from the wants delete', async () => {
    const { sessionToken, uid } = await createTestSession('wl-del-ratelimited-user');
    const username = await linkDiscogs(uid);

    discogsScope()
      .delete(`/users/${username}/wants/7`)
      .reply(429, { message: 'Too many requests' });

    const res = await request(app)
      .delete('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('discogs_rate_limited');
  });

  it('returns 503 discogs_unavailable on a 5xx from the wants delete', async () => {
    const { sessionToken, uid } = await createTestSession('wl-del-unavailable-user');
    const username = await linkDiscogs(uid);

    discogsScope().delete(`/users/${username}/wants/7`).reply(503, { message: 'boom' });

    const res = await request(app)
      .delete('/api/wantlist/7')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('discogs_unavailable');
  });
});

describe('GET /api/wantlist: page-param clamp', () => {
  it('clamps page to >= 1 and pageSize to the 1..50 range', async () => {
    const { sessionToken, uid } = await createTestSession('wl-clamp-user');
    const username = await linkDiscogs(uid);

    stubWantsPage(
      username,
      Array.from({ length: 3 }, (_v, i) =>
        rawWant(i + 1, { dateAdded: `2025-08-0${i + 1}T00:00:00-00:00` }),
      ),
    );
    discogsScope().get('/releases/1').reply(200, rawRelease(1));
    discogsScope().get('/releases/2').reply(200, rawRelease(2));
    discogsScope().get('/releases/3').reply(200, rawRelease(3));

    const res = await request(app)
      .get('/api/wantlist')
      .query({ page: 0, pageSize: 999 })
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(50);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.totalItems).toBe(3);
  });
});

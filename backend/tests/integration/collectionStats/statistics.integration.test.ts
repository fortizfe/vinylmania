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
  stubCollectionPage,
} from '../../helpers/nock';
import { createApp } from '../../../src/app';
import { getRedisClient } from '../../../src/adapters/cache/redisClient';
import { getFirestoreDb } from '../../../src/config/firebase-admin';
import { clearEmulatorFirestore, clearEmulatorUsers } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

/**
 * Feature 061, T024 (US1) — `GET /api/collection-stats/statistics`
 * (`contracts/collection-stats-api.md`). Emulator-backed (Firestore + Auth);
 * runs in CI where the emulators are up. MUST fail before T030 wires the
 * real handler (the stub returns 501).
 */

const app = createApp();

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

describe('GET /api/collection-stats/statistics (feature 061, US1)', () => {
  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/collection-stats/statistics');
    expect(res.status).toBe(401);
  });

  it('returns 409 discogs_not_linked when the caller has no Discogs connection', async () => {
    const { sessionToken } = await createTestSession('stats-unlinked-user');

    const res = await request(app)
      .get('/api/collection-stats/statistics')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('discogs_not_linked');
  });

  it('returns 401 discogs_link_invalid when the stored credentials are rejected', async () => {
    const { sessionToken, uid } = await createTestSession('stats-revoked-user');
    const username = await linkDiscogs(uid);

    discogsScope()
      .get(`/users/${username}/collection/fields`)
      .reply(401, { message: 'auth' });

    const res = await request(app)
      .get('/api/collection-stats/statistics')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('discogs_link_invalid');
  });

  it('returns 200 with the CollectionStatistics shape, computed from the mirror only', async () => {
    const { sessionToken, uid } = await createTestSession('stats-populated-user');
    const username = await linkDiscogs(uid);

    stubCollectionFields(username);
    stubCollectionPage(username, [
      rawCollectionInstance(1, {
        instanceId: 11,
        year: 1971,
        genres: ['Rock'],
        styles: ['Krautrock'],
        labels: [{ name: 'United Artists' }],
        artists: [{ name: 'Can' }],
        dateAdded: '2023-01-05T00:00:00-08:00',
      }),
      rawCollectionInstance(2, {
        instanceId: 22,
        year: 1979,
        genres: ['Rock', 'Electronic'],
        styles: ['New Wave'],
        labels: [{ name: 'United Artists' }],
        artists: [{ name: 'Can' }],
        dateAdded: '2023-03-05T00:00:00-08:00',
      }),
    ]);
    // No `/releases/:id` stub is registered — a catalog lookup would fail
    // loudly, proving `/statistics` issues zero catalog requests (FR-004).

    const res = await request(app)
      .get('/api/collection-stats/statistics')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalRecords).toBe(2);
    expect(res.body.byDecade.buckets).toEqual(
      expect.arrayContaining([{ label: '1970s', count: 2 }]),
    );
    expect(res.body.byGenre.buckets).toEqual(
      expect.arrayContaining([
        { label: 'Rock', count: 2 },
        { label: 'Electronic', count: 1 },
      ]),
    );
    expect(res.body.byGenre.others).toBeNull();
    expect(res.body.byLabel.buckets).toEqual([{ label: 'United Artists', count: 2 }]);
    expect(res.body.mostPresentArtist).toEqual({ name: 'Can', count: 2 });
    expect(res.body.growth.granularity).toBe('month');
    expect(res.body.growth.points[0]).toEqual({
      period: '2023-01',
      added: 1,
      cumulative: 1,
    });
    expect(res.body.growth.points.at(-1)).toEqual({
      period: '2023-03',
      added: 1,
      cumulative: 2,
    });
  });

  it('honors refresh=true by re-syncing past a fresh marker', async () => {
    const { sessionToken, uid } = await createTestSession('stats-refresh-user');
    const username = await linkDiscogs(uid);

    stubCollectionFields(username);
    stubCollectionPage(username, [rawCollectionInstance(1, { instanceId: 11 })]);

    const first = await request(app)
      .get('/api/collection-stats/statistics')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(first.status).toBe(200);
    expect(first.body.totalRecords).toBe(1);
    expect(await getRedisClient()!.get(`discogs:libsync:${uid}`)).not.toBeNull();

    // A record was added on discogs.com; the marker is still fresh.
    stubCollectionFields(username);
    stubCollectionPage(username, [
      rawCollectionInstance(1, { instanceId: 11 }),
      rawCollectionInstance(2, { instanceId: 22 }),
    ]);

    const refreshed = await request(app)
      .get('/api/collection-stats/statistics')
      .query({ refresh: 'true' })
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.totalRecords).toBe(2);
  });

  it('returns 200 with zeros for an empty collection', async () => {
    const { sessionToken, uid } = await createTestSession('stats-empty-user');
    const username = await linkDiscogs(uid);

    stubCollectionFields(username);
    stubCollectionPage(username, []);

    const res = await request(app)
      .get('/api/collection-stats/statistics')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalRecords: 0,
      byDecade: { buckets: [], others: null },
      byGenre: { buckets: [], others: null },
      byStyle: { buckets: [], others: null },
      byLabel: { buckets: [], others: null },
      topArtists: [],
      mostPresentArtist: null,
      growth: { granularity: 'month', points: [] },
    });
  });
});

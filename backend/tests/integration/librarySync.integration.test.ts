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
} from '../helpers/nock';
import { createApp } from '../../src/app';
import { getRedisClient } from '../../src/cache/redisClient';
import { getFirestoreDb } from '../../src/config/firebase-admin';
import { createEntry } from '../../src/library/libraryService';
import {
  clearEmulatorFirestore,
  clearEmulatorUsers,
  getTestIdToken,
} from '../helpers/authEmulator';

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

beforeAll(() => {
  // Route the throttle marker (and caches) through ioredis-mock.
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

describe('library sync-on-read throttle (FR-014)', () => {
  it('syncs on the first load, then serves the mirror without contacting Discogs within the TTL', async () => {
    const { idToken, uid } = await getTestIdToken('throttle-user');
    const username = await linkDiscogs(uid);

    stubCollectionFields(username);
    stubCollectionPage(username, [rawCollectionInstance(1, { instanceId: 11 })]);
    discogsScope().get('/releases/1').reply(200, rawRelease(1));

    const first = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);
    expect(first.status).toBe(200);
    expect(first.body.totalItems).toBe(1);

    const marker = await getRedisClient()!.get(`discogs:libsync:${uid}`);
    expect(marker).not.toBeNull();

    // No collection stubs remain: a second sync attempt would fail loudly.
    const second = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);
    expect(second.status).toBe(200);
    expect(second.body.totalItems).toBe(1);
  });

  it('refresh=true bypasses a fresh marker and picks up discogs.com-side changes', async () => {
    const { idToken, uid } = await getTestIdToken('refresh-bypass-user');
    const username = await linkDiscogs(uid);

    stubCollectionFields(username);
    stubCollectionPage(username, [rawCollectionInstance(1, { instanceId: 11 })]);
    discogsScope().get('/releases/1').reply(200, rawRelease(1));

    const first = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);
    expect(first.body.totalItems).toBe(1);

    // A record was added directly on discogs.com; the marker is still fresh.
    stubCollectionPage(username, [
      rawCollectionInstance(1, { instanceId: 11 }),
      rawCollectionInstance(2, { instanceId: 22 }),
    ]);
    discogsScope().get('/releases/2').reply(200, rawRelease(2));

    const withoutRefresh = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);
    expect(withoutRefresh.body.totalItems).toBe(1);

    const refreshed = await request(app)
      .get('/api/library')
      .query({ refresh: 'true' })
      .set('Authorization', `Bearer ${idToken}`);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.totalItems).toBe(2);
  });

  it('does not set the marker on a failed sync, so the next load retries', async () => {
    const { idToken, uid } = await getTestIdToken('retry-user');
    const username = await linkDiscogs(uid);
    await createEntry(uid, {
      discogsReleaseId: 1,
      discogsInstanceId: 11,
      discogsFolderId: 1,
    });

    stubCollectionFields(username);
    discogsScope()
      .get(`/users/${username}/collection/folders/0/releases`)
      .query(true)
      .reply(500, { message: 'boom' });

    const failed = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);
    expect(failed.status).toBe(503);
    expect(await getRedisClient()!.get(`discogs:libsync:${uid}`)).toBeNull();

    // Discogs recovers; the very next load syncs successfully.
    stubCollectionPage(username, [rawCollectionInstance(1, { instanceId: 11 })]);
    discogsScope().get('/releases/1').reply(200, rawRelease(1));

    const recovered = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);
    expect(recovered.status).toBe(200);
    expect(recovered.body.totalItems).toBe(1);
  });
});

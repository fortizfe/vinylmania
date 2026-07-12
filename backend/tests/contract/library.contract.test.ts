import request from 'supertest';

import {
  discogsScope,
  rawCollectionInstance,
  stubCollectionFields,
  stubCollectionPage,
} from '../helpers/nock';
import { createApp } from '../../src/app';
import { getFirestoreDb } from '../../src/config/firebase-admin';
import { createEntry, getEntry } from '../../src/library/libraryService';
import {
  clearEmulatorFirestore,
  clearEmulatorUsers,
  getTestIdToken,
} from '../helpers/authEmulator';

const app = createApp();

const rawRelease = {
  id: 1,
  title: 'Stockholm',
  year: 1999,
  artists: [{ id: 1, name: 'The Persuader', anv: '', join: '', role: '' }],
  labels: [{ id: 5, name: 'Svek', catno: 'SK032' }],
  formats: [{ name: 'Vinyl', qty: '2', descriptions: ['12"'] }],
  genres: ['Electronic'],
  styles: ['Deep House'],
  tracklist: [{ position: 'A', type_: 'track', title: 'Östermalm', duration: '4:45' }],
  images: [],
  uri: 'https://www.discogs.com/release/1-The-Persuader-Stockholm',
};

const rawReleaseJazz = {
  id: 2,
  title: 'Kind Of Blue',
  year: 1959,
  artists: [{ id: 2, name: 'Miles Davis', anv: '', join: '', role: '' }],
  labels: [{ id: 6, name: 'Columbia', catno: 'CL 1355' }],
  formats: [{ name: 'CD', qty: '1', descriptions: [] }],
  genres: ['Jazz'],
  styles: ['Modal'],
  tracklist: [],
  images: [],
  uri: 'https://www.discogs.com/release/2-Miles-Davis-Kind-Of-Blue',
};

beforeAll(() => {
  // Deterministic behavior regardless of a local Redis: no throttle marker
  // (every list GET syncs) and no cached per-user field map.
  delete process.env.REDIS_URL;
});

afterEach(async () => {
  await clearEmulatorUsers();
  await clearEmulatorFirestore();
});

/** Seeds a Discogs connection doc as feature 015's completeLink would. */
async function linkDiscogs(
  uid: string,
  options: { initialLibrarySyncAt?: Date } = {},
): Promise<string> {
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
      ...(options.initialLibrarySyncAt
        ? { initialLibrarySyncAt: options.initialLibrarySyncAt }
        : {}),
    });
  return username;
}

/** Seeds a pre-016 entry shape (legacy condition/notes, no instance ids). */
async function seedLegacyEntry(
  uid: string,
  data: { discogsReleaseId: number; condition?: string; notes?: string },
): Promise<string> {
  const doc = getFirestoreDb()
    .collection('users')
    .doc(uid)
    .collection('libraryEntries')
    .doc();
  await doc.set({ ...data, addedAt: new Date('2026-06-01T00:00:00.000Z') });
  return doc.id;
}

async function createSyncedEntry(uid: string, releaseId: number, instanceId: number) {
  return createEntry(uid, {
    discogsReleaseId: releaseId,
    discogsInstanceId: instanceId,
    discogsFolderId: 1,
  });
}

describe('Library API contract: unlinked users are gated (FR-003)', () => {
  it.each([
    ['GET list', () => request(app).get('/api/library')],
    ['GET detail', () => request(app).get('/api/library/some-id')],
    [
      'POST create',
      () => request(app).post('/api/library').send({ discogsReleaseId: 1 }),
    ],
    [
      'PATCH update',
      () => request(app).patch('/api/library/some-id').send({ rating: 3 }),
    ],
    ['DELETE remove', () => request(app).delete('/api/library/some-id')],
  ])(
    '%s returns 409 discogs_not_linked without a connection',
    async (_name, makeRequest) => {
      const { idToken } = await getTestIdToken(
        `unlinked-${Math.random().toString(36).slice(2)}`,
      );

      const res = await makeRequest().set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('discogs_not_linked');
      expect(res.body.message).toEqual(expect.any(String));
    },
  );

  it('still returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/library');
    expect(res.status).toBe(401);
  });
});

describe('Library API contract: GET /api/library (sync-on-read)', () => {
  it('mirrors Discogs-only instances into the library (US1)', async () => {
    const { idToken, uid } = await getTestIdToken('sync-mirror-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });

    stubCollectionFields(username);
    stubCollectionPage(username, [
      rawCollectionInstance(1, {
        instanceId: 11,
        dateAdded: '2026-02-03T00:00:00-08:00',
      }),
    ]);
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      discogsReleaseId: 1,
      catalogStatus: 'ok',
      release: expect.objectContaining({ title: 'Stockholm' }),
    });
    expect(res.body.items[0].condition).toBeUndefined();
    expect(res.body.items[0].notes).toBeUndefined();
    expect(res.body.items[0]).toHaveProperty('discogs');
  });

  it('first sync pushes Firestore-only entries to Discogs and migrates legacy data (FR-002, FR-010)', async () => {
    const { idToken, uid } = await getTestIdToken('first-sync-user');
    const username = await linkDiscogs(uid);
    const entryId = await seedLegacyEntry(uid, {
      discogsReleaseId: 1,
      condition: 'Near Mint',
      notes: 'Bought at a record fair',
    });

    stubCollectionFields(username);
    stubCollectionPage(username, []);
    discogsScope()
      .post(`/users/${username}/collection/folders/1/releases/1`)
      .reply(201, { instance_id: 777 });
    const mediaWrite = discogsScope()
      .post(`/users/${username}/collection/folders/1/releases/1/instances/777/fields/1`, {
        value: 'Near Mint (NM or M-)',
      })
      .reply(204);
    const notesWrite = discogsScope()
      .post(`/users/${username}/collection/folders/1/releases/1/instances/777/fields/3`, {
        value: 'Bought at a record fair',
      })
      .reply(204);
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(1);
    expect(mediaWrite.isDone()).toBe(true);
    expect(notesWrite.isDone()).toBe(true);

    // Legacy fields deleted only after the confirmed Discogs writes.
    const raw = await getFirestoreDb()
      .collection('users')
      .doc(uid)
      .collection('libraryEntries')
      .doc(entryId)
      .get();
    expect(raw.data()!.condition).toBeUndefined();
    expect(raw.data()!.notes).toBeUndefined();
    expect(raw.data()!.discogsInstanceId).toBe(777);

    // The connection is marked so the next sync runs in mirror mode.
    const connection = await getFirestoreDb()
      .collection('discogsConnections')
      .doc(uid)
      .get();
    expect(connection.data()!.initialLibrarySyncAt).toBeDefined();
  });

  it('after the first sync, records deleted on Discogs disappear and are not re-added (clarification #1)', async () => {
    const { idToken, uid } = await getTestIdToken('mirror-delete-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    await createSyncedEntry(uid, 1, 11);

    stubCollectionFields(username);
    stubCollectionPage(username, []); // deleted on discogs.com

    const res = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it('accepts refresh=true and still serves the synced library', async () => {
    const { idToken, uid } = await getTestIdToken('refresh-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });

    stubCollectionFields(username);
    stubCollectionPage(username, []);

    const res = await request(app)
      .get('/api/library')
      .query({ refresh: 'true' })
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('returns 401 discogs_link_invalid when Discogs rejects the stored credentials (FR-012)', async () => {
    const { idToken, uid } = await getTestIdToken('revoked-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });

    discogsScope()
      .get(`/users/${username}/collection/fields`)
      .reply(401, { message: 'You must authenticate.' });

    const res = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('discogs_link_invalid');
  });

  it('returns 503 discogs_unavailable and leaves the mirror intact on a mid-pass failure (FR-011)', async () => {
    const { idToken, uid } = await getTestIdToken('sync-failure-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    const existing = await createSyncedEntry(uid, 1, 11);

    stubCollectionFields(username);
    discogsScope()
      .get(`/users/${username}/collection/folders/0/releases`)
      .query(true)
      .reply(500, { message: 'boom' });

    const res = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('discogs_unavailable');
    await expect(getEntry(uid, existing.id)).resolves.not.toBeNull();
  });
});

describe('Library API contract: GET /api/library genre/style/format filtering (feature 038, US2)', () => {
  it('returns items enriched with persisted genre/style/format fields', async () => {
    const { idToken, uid } = await getTestIdToken('filter-fields-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });

    stubCollectionFields(username);
    stubCollectionPage(username, [
      rawCollectionInstance(1, { instanceId: 11, dateAdded: '2026-02-03T00:00:00-08:00' }),
    ]);
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      genre: ['Electronic'],
      style: ['Deep House'],
      format: ['Vinyl'],
    });
  });

  it('returns only entries matching an active genre filter, with pagination computed over the filtered subset (FR-017)', async () => {
    const { idToken, uid } = await getTestIdToken('filter-genre-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });

    const instances = [
      rawCollectionInstance(1, { instanceId: 11, dateAdded: '2026-02-03T00:00:00-08:00' }),
      rawCollectionInstance(2, { instanceId: 12, dateAdded: '2026-02-02T00:00:00-08:00' }),
    ];
    // Sync's collection endpoints are hit fresh on every GET (each nock
    // stub is single-use), so both requests below need their own stubs.
    stubCollectionFields(username);
    stubCollectionPage(username, instances);
    discogsScope().get('/releases/1').reply(200, rawRelease);
    discogsScope().get('/releases/2').reply(200, rawReleaseJazz);

    // First, unfiltered sync/enrichment populates genre/style/format for both.
    const unfiltered = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${idToken}`);
    expect(unfiltered.body.totalItems).toBe(2);

    stubCollectionFields(username);
    stubCollectionPage(username, instances);

    const filtered = await request(app)
      .get('/api/library')
      .query({ genre: 'Electronic' })
      .set('Authorization', `Bearer ${idToken}`);

    expect(filtered.status).toBe(200);
    expect(filtered.body.totalItems).toBe(1);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0]).toMatchObject({ discogsReleaseId: 1 });
  });

  it('combines multiple genre values with OR and different fields with AND (FR-015)', async () => {
    const { idToken, uid } = await getTestIdToken('filter-combo-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    const instances = [
      rawCollectionInstance(1, { instanceId: 11, dateAdded: '2026-02-03T00:00:00-08:00' }),
      rawCollectionInstance(2, { instanceId: 12, dateAdded: '2026-02-02T00:00:00-08:00' }),
    ];

    stubCollectionFields(username);
    stubCollectionPage(username, instances);
    discogsScope().get('/releases/1').reply(200, rawRelease);
    discogsScope().get('/releases/2').reply(200, rawReleaseJazz);
    await request(app).get('/api/library').set('Authorization', `Bearer ${idToken}`);

    stubCollectionFields(username);
    stubCollectionPage(username, instances);
    const orMatch = await request(app)
      .get('/api/library')
      .query({ genre: 'Electronic,Jazz' })
      .set('Authorization', `Bearer ${idToken}`);
    expect(orMatch.body.totalItems).toBe(2);

    stubCollectionFields(username);
    stubCollectionPage(username, instances);
    const andMismatch = await request(app)
      .get('/api/library')
      .query({ genre: 'Electronic', style: 'Modal' })
      .set('Authorization', `Bearer ${idToken}`);
    expect(andMismatch.body.totalItems).toBe(0);
    expect(andMismatch.body.items).toEqual([]);
  });

  it('a never-enriched entry does not match any active filter until its next successful sync (FR-019)', async () => {
    const { idToken, uid } = await getTestIdToken('filter-never-enriched-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    // A pre-existing entry with no genre/style/format yet (never enriched).
    await createSyncedEntry(uid, 1, 11);
    const instances = [
      rawCollectionInstance(1, { instanceId: 11, dateAdded: '2026-02-03T00:00:00-08:00' }),
    ];

    stubCollectionFields(username);
    stubCollectionPage(username, instances);

    const filteredBefore = await request(app)
      .get('/api/library')
      .query({ genre: 'Electronic' })
      .set('Authorization', `Bearer ${idToken}`);
    expect(filteredBefore.body.totalItems).toBe(0);

    // An unfiltered load enriches (and persists) the entry's catalog fields.
    stubCollectionFields(username);
    stubCollectionPage(username, instances);
    discogsScope().get('/releases/1').reply(200, rawRelease);
    await request(app).get('/api/library').set('Authorization', `Bearer ${idToken}`);

    stubCollectionFields(username);
    stubCollectionPage(username, instances);
    // Only consumed if the release cache expired; a cache hit leaves it unused.
    discogsScope().get('/releases/1').reply(200, rawRelease);
    const filteredAfter = await request(app)
      .get('/api/library')
      .query({ genre: 'Electronic' })
      .set('Authorization', `Bearer ${idToken}`);
    expect(filteredAfter.body.totalItems).toBe(1);
  });
});

describe('Library API contract: GET /api/library/:id (per-copy data)', () => {
  it('returns the enriched entry with its Discogs per-copy data (US2)', async () => {
    const { idToken, uid } = await getTestIdToken('detail-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    const entry = await createSyncedEntry(uid, 1, 11);

    stubCollectionFields(username);
    discogsScope()
      .get(`/users/${username}/collection/releases/1`)
      .reply(200, {
        pagination: { page: 1, pages: 1, per_page: 100, items: 1 },
        releases: [
          rawCollectionInstance(1, {
            instanceId: 11,
            folderId: 4,
            rating: 4,
            mediaCondition: 'Very Good Plus (VG+)',
            sleeveCondition: 'Generic',
            notes: 'First pressing',
          }),
        ],
      });
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .get(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.discogs).toEqual({
      instanceId: 11,
      folderId: 4,
      rating: 4,
      mediaCondition: 'Very Good Plus (VG+)',
      sleeveCondition: 'Generic',
      notes: 'First pressing',
      editable: { mediaCondition: true, sleeveCondition: true, notes: true },
    });
    expect(res.body.condition).toBeUndefined();
    expect(res.body.notes).toBeUndefined();
  });

  it('marks controls not editable when the user deleted a Discogs custom field', async () => {
    const { idToken, uid } = await getTestIdToken('detail-nofields-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    const entry = await createSyncedEntry(uid, 1, 11);

    stubCollectionFields(username, {
      fields: [{ id: 3, name: 'Notes', type: 'textarea' }],
    });
    discogsScope()
      .get(`/users/${username}/collection/releases/1`)
      .reply(200, {
        pagination: { page: 1, pages: 1, per_page: 100, items: 1 },
        releases: [rawCollectionInstance(1, { instanceId: 11 })],
      });
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .get(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.discogs.editable).toEqual({
      mediaCondition: false,
      sleeveCondition: false,
      notes: true,
    });
  });

  it('returns 404 entry_not_found for an entry that does not exist', async () => {
    const { idToken, uid } = await getTestIdToken('detail-missing-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .get('/api/library/does-not-exist')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('entry_not_found');
  });

  it('returns 404 entry_not_found for an entry belonging to a different collector', async () => {
    const owner = await getTestIdToken('detail-owner-user');
    const other = await getTestIdToken('detail-other-user');
    await linkDiscogs(owner.uid);
    await linkDiscogs(other.uid);
    const entry = await createSyncedEntry(owner.uid, 1, 11);

    const res = await request(app)
      .get(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${other.idToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('entry_not_found');
  });
});

describe('Library API contract: POST /api/library (write-through add, US3)', () => {
  it('adds to the Discogs collection first, then mirrors the entry', async () => {
    const { idToken, uid } = await getTestIdToken('add-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });

    discogsScope().get('/releases/1').reply(200, rawRelease);
    const discogsAdd = discogsScope()
      .post(`/users/${username}/collection/folders/1/releases/1`)
      .reply(201, { instance_id: 900 });
    stubCollectionFields(username);

    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(201);
    expect(discogsAdd.isDone()).toBe(true);
    expect(res.body).toMatchObject({
      discogsReleaseId: 1,
      catalogStatus: 'ok',
      release: expect.objectContaining({ title: 'Stockholm' }),
      discogs: expect.objectContaining({ instanceId: 900, folderId: 1, rating: 0 }),
    });
    expect(res.body.condition).toBeUndefined();

    const persisted = await getEntry(uid, res.body.id);
    expect(persisted).toMatchObject({ discogsInstanceId: 900, discogsFolderId: 1 });
  });

  it('rejects legacy condition/notes keys with 400 invalid_request (breaking change)', async () => {
    const { idToken, uid } = await getTestIdToken('add-legacy-body-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ discogsReleaseId: 1, condition: 'Mint', notes: 'nope' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('returns 404 release_not_found and adds nothing when the release does not exist', async () => {
    const { idToken, uid } = await getTestIdToken('add-notfound-user');
    await linkDiscogs(uid);
    discogsScope().get('/releases/999999999').reply(404, { message: 'not found' });

    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ discogsReleaseId: 999999999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('release_not_found');
  });

  it('does not mirror the record when the Discogs add fails (FR-004)', async () => {
    const { idToken, uid } = await getTestIdToken('add-discogs-fail-user');
    const username = await linkDiscogs(uid);

    discogsScope().get('/releases/1').reply(200, rawRelease);
    discogsScope()
      .post(`/users/${username}/collection/folders/1/releases/1`)
      .reply(500, { message: 'boom' });

    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('discogs_unavailable');

    const list = await getFirestoreDb()
      .collection('users')
      .doc(uid)
      .collection('libraryEntries')
      .get();
    expect(list.empty).toBe(true);
  });

  it('returns 401 discogs_link_invalid when the Discogs add is rejected as unauthorized', async () => {
    const { idToken, uid } = await getTestIdToken('add-revoked-user');
    const username = await linkDiscogs(uid);

    discogsScope().get('/releases/1').reply(200, rawRelease);
    discogsScope()
      .post(`/users/${username}/collection/folders/1/releases/1`)
      .reply(401, { message: 'You must authenticate.' });

    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('discogs_link_invalid');
  });
});

describe('Library API contract: PATCH /api/library/:id (per-copy edits, US2)', () => {
  it('persists a rating change through the instance endpoint', async () => {
    const { idToken, uid } = await getTestIdToken('patch-rating-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    const entry = await createSyncedEntry(uid, 1, 11);

    const ratingWrite = discogsScope()
      .post(`/users/${username}/collection/folders/1/releases/1/instances/11`, {
        rating: 4,
      })
      .reply(204);
    stubCollectionFields(username);
    discogsScope()
      .get(`/users/${username}/collection/releases/1`)
      .reply(200, {
        pagination: { page: 1, pages: 1, per_page: 100, items: 1 },
        releases: [rawCollectionInstance(1, { instanceId: 11, rating: 4 })],
      });
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .patch(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ rating: 4 });

    expect(res.status).toBe(200);
    expect(ratingWrite.isDone()).toBe(true);
    expect(res.body.discogs.rating).toBe(4);
  });

  it('persists a sleeve-condition change through the fields endpoint', async () => {
    const { idToken, uid } = await getTestIdToken('patch-sleeve-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    const entry = await createSyncedEntry(uid, 1, 11);

    // Without Redis the field map is fetched by the write and by the readback.
    stubCollectionFields(username);
    stubCollectionFields(username);
    const fieldWrite = discogsScope()
      .post(`/users/${username}/collection/folders/1/releases/1/instances/11/fields/2`, {
        value: 'Generic',
      })
      .reply(204);
    discogsScope()
      .get(`/users/${username}/collection/releases/1`)
      .reply(200, {
        pagination: { page: 1, pages: 1, per_page: 100, items: 1 },
        releases: [
          rawCollectionInstance(1, { instanceId: 11, sleeveCondition: 'Generic' }),
        ],
      });
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .patch(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ sleeveCondition: 'Generic' });

    expect(res.status).toBe(200);
    expect(fieldWrite.isDone()).toBe(true);
    expect(res.body.discogs.sleeveCondition).toBe('Generic');
  });

  it('rejects a condition outside the Discogs grading set with 400 (FR-008)', async () => {
    const { idToken, uid } = await getTestIdToken('patch-bad-condition-user');
    await linkDiscogs(uid);
    const entry = await createSyncedEntry(uid, 1, 11);

    const res = await request(app)
      .patch(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ mediaCondition: 'Almost New' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('rejects an out-of-range rating with 400', async () => {
    const { idToken, uid } = await getTestIdToken('patch-bad-rating-user');
    await linkDiscogs(uid);
    const entry = await createSyncedEntry(uid, 1, 11);

    const res = await request(app)
      .patch(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ rating: 9 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('rejects legacy condition/unknown keys with 400 (breaking change)', async () => {
    const { idToken, uid } = await getTestIdToken('patch-legacy-body-user');
    await linkDiscogs(uid);
    const entry = await createSyncedEntry(uid, 1, 11);

    const res = await request(app)
      .patch(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ condition: 'Mint' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('rejects editing a field the user deleted on discogs.com with 400', async () => {
    const { idToken, uid } = await getTestIdToken('patch-nofield-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    const entry = await createSyncedEntry(uid, 1, 11);

    stubCollectionFields(username, {
      fields: [{ id: 3, name: 'Notes', type: 'textarea' }],
    });

    const res = await request(app)
      .patch(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ mediaCondition: 'Good (G)' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('returns 401 discogs_link_invalid when the Discogs write is rejected as unauthorized', async () => {
    const { idToken, uid } = await getTestIdToken('patch-revoked-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    const entry = await createSyncedEntry(uid, 1, 11);

    discogsScope()
      .post(`/users/${username}/collection/folders/1/releases/1/instances/11`, {
        rating: 2,
      })
      .reply(401, { message: 'You must authenticate.' });

    const res = await request(app)
      .patch(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ rating: 2 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('discogs_link_invalid');
  });

  it('returns 404 entry_not_found for an entry that does not exist', async () => {
    const { idToken, uid } = await getTestIdToken('patch-missing-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .patch('/api/library/does-not-exist')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ rating: 3 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('entry_not_found');
  });
});

describe('Library API contract: DELETE /api/library/:id (write-through remove, US4)', () => {
  it('removes the Discogs instance first, then the mirror entry', async () => {
    const { idToken, uid } = await getTestIdToken('delete-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    const entry = await createSyncedEntry(uid, 1, 11);

    const discogsDelete = discogsScope()
      .delete(`/users/${username}/collection/folders/1/releases/1/instances/11`)
      .reply(204);

    const res = await request(app)
      .delete(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(204);
    expect(discogsDelete.isDone()).toBe(true);
    await expect(getEntry(uid, entry.id)).resolves.toBeNull();
  });

  it('still removes the mirror entry when Discogs reports the instance already gone', async () => {
    const { idToken, uid } = await getTestIdToken('delete-converged-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    const entry = await createSyncedEntry(uid, 1, 11);

    discogsScope()
      .delete(`/users/${username}/collection/folders/1/releases/1/instances/11`)
      .reply(404, { message: 'Instance not found.' });

    const res = await request(app)
      .delete(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(204);
    await expect(getEntry(uid, entry.id)).resolves.toBeNull();
  });

  it('keeps the entry and returns 503 when the Discogs removal fails (FR-005)', async () => {
    const { idToken, uid } = await getTestIdToken('delete-fail-user');
    const username = await linkDiscogs(uid, { initialLibrarySyncAt: new Date() });
    const entry = await createSyncedEntry(uid, 1, 11);

    discogsScope()
      .delete(`/users/${username}/collection/folders/1/releases/1/instances/11`)
      .reply(500, { message: 'boom' });

    const res = await request(app)
      .delete(`/api/library/${entry.id}`)
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('discogs_unavailable');
    await expect(getEntry(uid, entry.id)).resolves.not.toBeNull();
  });

  it('returns 404 entry_not_found for an entry that does not exist', async () => {
    const { idToken, uid } = await getTestIdToken('delete-missing-user');
    await linkDiscogs(uid);

    const res = await request(app)
      .delete('/api/library/does-not-exist')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('entry_not_found');
  });
});

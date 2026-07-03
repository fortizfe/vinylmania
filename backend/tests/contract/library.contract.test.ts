import request from 'supertest';

import { discogsScope } from '../helpers/nock';
import { createApp } from '../../src/app';
import { createEntry } from '../../src/library/libraryService';
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

describe('Library API contract: POST /api/library', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('creates a library entry after verifying the release exists', async () => {
    const { idToken } = await getTestIdToken('create-entry-user');
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ discogsReleaseId: 1, condition: 'Near Mint', notes: 'Bought at a record fair' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      discogsReleaseId: 1,
      condition: 'Near Mint',
      notes: 'Bought at a record fair',
      catalogStatus: 'ok',
      release: expect.objectContaining({ discogsId: 1, title: 'Stockholm' }),
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.addedAt).toEqual(expect.any(String));
  });

  it('returns 404 release_not_found and creates nothing when the release does not exist', async () => {
    const { idToken } = await getTestIdToken('create-entry-notfound-user');
    discogsScope().get('/releases/999999999').reply(404, { message: 'not found' });

    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ discogsReleaseId: 999999999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('release_not_found');
  });

  it('returns 502 catalog_unavailable and creates nothing when Discogs cannot be reached', async () => {
    const { idToken } = await getTestIdToken('create-entry-unavailable-user');
    discogsScope().get('/releases/1').reply(500, { message: 'server error' });

    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ discogsReleaseId: 1 });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('catalog_unavailable');
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).post('/api/library').send({ discogsReleaseId: 1 });

    expect(res.status).toBe(401);
  });
});

describe('Library API contract: GET /api/library', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('returns a paginated, enriched list with mixed catalog availability', async () => {
    const { idToken, uid } = await getTestIdToken('list-entries-user');
    await createEntry(uid, { discogsReleaseId: 1, condition: 'Mint' });
    await createEntry(uid, { discogsReleaseId: 999999999 });

    discogsScope().get('/releases/1').reply(200, rawRelease);
    discogsScope().get('/releases/999999999').reply(404, { message: 'not found' });

    const res = await request(app)
      .get('/api/library')
      .query({ page: '1', pageSize: '20' })
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.totalItems).toBe(2);
    expect(res.body.items).toHaveLength(2);

    const ok = res.body.items.find((item: { discogsReleaseId: number }) => item.discogsReleaseId === 1);
    const unavailable = res.body.items.find(
      (item: { discogsReleaseId: number }) => item.discogsReleaseId === 999999999,
    );

    expect(ok).toMatchObject({ catalogStatus: 'ok', release: expect.objectContaining({ title: 'Stockholm' }) });
    expect(unavailable).toMatchObject({ catalogStatus: 'unavailable', release: null });
  });

  it('returns an empty list for a collector with no entries', async () => {
    const { idToken } = await getTestIdToken('empty-library-user');

    const res = await request(app).get('/api/library').set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalItems).toBe(0);
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/library');

    expect(res.status).toBe(401);
  });
});

describe('Library API contract: GET /api/library/:id', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('returns the enriched entry for its owner', async () => {
    const { idToken, uid } = await getTestIdToken('get-entry-user');
    const created = await createEntry(uid, { discogsReleaseId: 1, notes: 'Great copy' });
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .get(`/api/library/${created.id}`)
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.id,
      notes: 'Great copy',
      catalogStatus: 'ok',
      release: expect.objectContaining({ title: 'Stockholm' }),
    });
  });

  it('returns 404 entry_not_found for an entry that does not exist', async () => {
    const { idToken } = await getTestIdToken('get-entry-missing-user');

    const res = await request(app)
      .get('/api/library/does-not-exist')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('entry_not_found');
  });

  it('returns 404 entry_not_found for an entry belonging to a different collector', async () => {
    const owner = await getTestIdToken('get-entry-owner-user');
    const other = await getTestIdToken('get-entry-other-user');
    const created = await createEntry(owner.uid, { discogsReleaseId: 1 });

    const res = await request(app)
      .get(`/api/library/${created.id}`)
      .set('Authorization', `Bearer ${other.idToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('entry_not_found');
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/library/some-id');

    expect(res.status).toBe(401);
  });
});

describe('Library API contract: DELETE /api/library/:id', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('removes the entry and returns 204', async () => {
    const { idToken, uid } = await getTestIdToken('delete-entry-user');
    const created = await createEntry(uid, { discogsReleaseId: 1 });

    const res = await request(app)
      .delete(`/api/library/${created.id}`)
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(204);

    const after = await request(app)
      .get(`/api/library/${created.id}`)
      .set('Authorization', `Bearer ${idToken}`);
    expect(after.status).toBe(404);
  });

  it('returns 404 entry_not_found for an entry that does not exist', async () => {
    const { idToken } = await getTestIdToken('delete-entry-missing-user');

    const res = await request(app)
      .delete('/api/library/does-not-exist')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('entry_not_found');
  });

  it('returns 404 entry_not_found for an entry belonging to a different collector', async () => {
    const owner = await getTestIdToken('delete-entry-owner-user');
    const other = await getTestIdToken('delete-entry-other-user');
    const created = await createEntry(owner.uid, { discogsReleaseId: 1 });

    const res = await request(app)
      .delete(`/api/library/${created.id}`)
      .set('Authorization', `Bearer ${other.idToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('entry_not_found');
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).delete('/api/library/some-id');

    expect(res.status).toBe(401);
  });
});

describe('Library API contract: PATCH /api/library/:id', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('updates condition and notes for the owner', async () => {
    const { idToken, uid } = await getTestIdToken('patch-entry-user');
    const created = await createEntry(uid, { discogsReleaseId: 1, condition: 'Good' });
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .patch(`/api/library/${created.id}`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ condition: 'Mint', notes: 'Regraded after cleaning' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.id,
      condition: 'Mint',
      notes: 'Regraded after cleaning',
      catalogStatus: 'ok',
    });
  });

  it('returns 404 entry_not_found for an entry that does not exist', async () => {
    const { idToken } = await getTestIdToken('patch-entry-missing-user');

    const res = await request(app)
      .patch('/api/library/does-not-exist')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ condition: 'Mint' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('entry_not_found');
  });

  it('returns 404 entry_not_found for an entry belonging to a different collector', async () => {
    const owner = await getTestIdToken('patch-entry-owner-user');
    const other = await getTestIdToken('patch-entry-other-user');
    const created = await createEntry(owner.uid, { discogsReleaseId: 1 });

    const res = await request(app)
      .patch(`/api/library/${created.id}`)
      .set('Authorization', `Bearer ${other.idToken}`)
      .send({ condition: 'Mint' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('entry_not_found');
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).patch('/api/library/some-id').send({ condition: 'Mint' });

    expect(res.status).toBe(401);
  });
});

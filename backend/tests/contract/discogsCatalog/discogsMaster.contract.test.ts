import request from 'supertest';

import { discogsScope } from '../../helpers/nock';
import { createApp } from '../../../src/app';
import { getFirestoreDb } from '../../../src/config/firebase-admin';
import { MAX_ATTEMPTS } from '../../../src/discogs/discogsRetry';
import { clearEmulatorUsers, clearEmulatorFirestore } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

const app = createApp();

const OAUTH_TOKEN_HEADER = /oauth_token="access-token"/;
const APP_TOKEN_HEADER = /^Discogs token=/;

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

const rawMaster = {
  id: 1660109,
  title: 'Hybrid Theory',
  year: 2000,
  artists: [{ id: 1, name: 'Linkin Park', anv: '', join: '', role: '' }],
  genres: ['Rock'],
  styles: ['Nu Metal'],
  images: [
    { type: 'primary', uri: 'https://example.com/cover.jpg', width: 600, height: 600 },
  ],
  tracklist: [{ position: '1', type_: 'track', title: 'Papercut', duration: '3:05' }],
  main_release: 98765,
  uri: 'https://www.discogs.com/master/1660109-Linkin-Park-Hybrid-Theory',
};

describe('Discogs master API contract: GET /api/discogs/masters/:discogsId', () => {
  beforeAll(() => {
    // Deterministic behavior regardless of a local Redis: the success and
    // rate-limit tests below reuse master ID 1660109, which a real
    // cache-aside hit would otherwise short-circuit.
    delete process.env.REDIS_URL;
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('signs the request with the linked user OAuth token when the caller has an active connection (spec 053, US1)', async () => {
    const { sessionToken, uid } = await createTestSession('master-linked-user');
    await linkDiscogs(uid);
    discogsScope()
      .get('/masters/3001')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, { ...rawMaster, id: 3001 });

    const res = await request(app)
      .get('/api/discogs/masters/3001')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.discogsId).toBe(3001);
  });

  it('signs the request with DISCOGS_TOKEN when the caller has no linked account (spec 053, US2)', async () => {
    const { sessionToken } = await createTestSession('master-unlinked-user');
    discogsScope()
      .get('/masters/3002')
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(200, { ...rawMaster, id: 3002 });

    const res = await request(app)
      .get('/api/discogs/masters/3002')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.discogsId).toBe(3002);
  });

  it('returns 401 discogs_link_invalid, without ever calling the vinylmania-token stub, when the linked account is revoked (spec 053, US3)', async () => {
    const { sessionToken, uid } = await createTestSession('master-revoked-user');
    await linkDiscogs(uid);
    const oauthScope = discogsScope()
      .get('/masters/3005')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(401, { message: 'unauthorized' });
    const appTokenScope = discogsScope()
      .get('/masters/3005')
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(200, { ...rawMaster, id: 3005 });

    const res = await request(app)
      .get('/api/discogs/masters/3005')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'discogs_link_invalid',
      message: 'Your Discogs link is no longer valid. Please re-link your account from your profile.',
    });
    expect(oauthScope.isDone()).toBe(true);
    expect(appTokenScope.isDone()).toBe(false);
  });

  it('falls through to 500 internal_error (not discogs_link_invalid) when DISCOGS_TOKEN itself is rejected for an unlinked user (spec 053, mis-attribution guard)', async () => {
    const { sessionToken } = await createTestSession('master-badtoken-user');
    discogsScope()
      .get('/masters/3006')
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(401, { message: 'unauthorized' });

    const res = await request(app)
      .get('/api/discogs/masters/3006')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_error');
  });

  it('returns the mapped master release for an authenticated caller', async () => {
    const { sessionToken } = await createTestSession('master-detail-user');

    discogsScope().get('/masters/1660109').reply(200, rawMaster);

    const res = await request(app)
      .get('/api/discogs/masters/1660109')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      discogsId: 1660109,
      title: 'Hybrid Theory',
      year: 2000,
      artists: [{ discogsArtistId: 1, name: 'Linkin Park' }],
      genres: ['Rock'],
      styles: ['Nu Metal'],
      images: [
        {
          url: 'https://example.com/cover.jpg',
          imageType: 'primary',
          width: 600,
          height: 600,
        },
      ],
      tracklist: [{ position: '1', title: 'Papercut', duration: '3:05' }],
      mainReleaseId: 98765,
      discogsUrl: 'https://www.discogs.com/master/1660109-Linkin-Park-Hybrid-Theory',
    });
  });

  it('returns 404 master_not_found when Discogs has no master for that ID', async () => {
    const { sessionToken } = await createTestSession('master-detail-notfound-user');

    discogsScope().get('/masters/999999999').reply(404, { message: 'Master not found' });

    const res = await request(app)
      .get('/api/discogs/masters/999999999')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('master_not_found');
  });

  it('returns 502 catalog_unavailable when Discogs is rate-limited', async () => {
    const { sessionToken } = await createTestSession('master-detail-ratelimit-user');

    discogsScope()
      .get('/masters/1660109')
      .times(MAX_ATTEMPTS)
      .reply(429, { message: 'too many requests' });

    const res = await request(app)
      .get('/api/discogs/masters/1660109')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('catalog_unavailable');
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/discogs/masters/1660109');

    expect(res.status).toBe(401);
  });
});

describe('Discogs master versions API contract: GET /api/discogs/masters/:discogsId/versions', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('signs the request with the linked user OAuth token when the caller has an active connection (spec 053, US1)', async () => {
    const { sessionToken, uid } = await createTestSession('master-versions-linked-user');
    await linkDiscogs(uid);
    discogsScope()
      .get('/masters/3003/versions')
      .query({ page: '1', per_page: '10' })
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, { pagination: { page: 1, pages: 1, items: 0, per_page: 10 }, versions: [] });

    const res = await request(app)
      .get('/api/discogs/masters/3003/versions')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
  });

  it('signs the request with DISCOGS_TOKEN when the caller has no linked account (spec 053, US2)', async () => {
    const { sessionToken } = await createTestSession('master-versions-unlinked-user');
    discogsScope()
      .get('/masters/3004/versions')
      .query({ page: '1', per_page: '10' })
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(200, { pagination: { page: 1, pages: 1, items: 0, per_page: 10 }, versions: [] });

    const res = await request(app)
      .get('/api/discogs/masters/3004/versions')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
  });

  it('returns 401 discogs_link_invalid, without ever calling the vinylmania-token stub, when the linked account is revoked (spec 053, US3)', async () => {
    const { sessionToken, uid } = await createTestSession('master-versions-revoked-user');
    await linkDiscogs(uid);
    const oauthScope = discogsScope()
      .get('/masters/3007/versions')
      .query({ page: '1', per_page: '10' })
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(401, { message: 'unauthorized' });
    const appTokenScope = discogsScope()
      .get('/masters/3007/versions')
      .query({ page: '1', per_page: '10' })
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(200, { pagination: { page: 1, pages: 1, items: 0, per_page: 10 }, versions: [] });

    const res = await request(app)
      .get('/api/discogs/masters/3007/versions')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'discogs_link_invalid',
      message: 'Your Discogs link is no longer valid. Please re-link your account from your profile.',
    });
    expect(oauthScope.isDone()).toBe(true);
    expect(appTokenScope.isDone()).toBe(false);
  });

  it('returns a paginated version list, defaulting to 10 per page (spec FR-009)', async () => {
    const { sessionToken } = await createTestSession('master-versions-user');

    discogsScope()
      .get('/masters/1660109/versions')
      .query({ page: '1', per_page: '10' })
      .reply(200, {
        pagination: { page: 1, pages: 3, items: 27, per_page: 10 },
        versions: [
          {
            id: 98765,
            title: 'Hybrid Theory',
            format: 'Vinyl, LP, Album',
            label: 'Warner Bros. Records',
            catno: '9362-47755-1',
            released: '2000',
            country: 'US',
            thumb: 'https://example.com/thumb.jpg',
          },
        ],
      });

    const res = await request(app)
      .get('/api/discogs/masters/1660109/versions')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      results: [
        {
          discogsId: 98765,
          title: 'Hybrid Theory',
          format: 'Vinyl, LP, Album',
          label: 'Warner Bros. Records',
          year: 2000,
          country: 'US',
          thumbnailUrl: 'https://example.com/thumb.jpg',
        },
      ],
      pagination: { page: 1, pages: 3, items: 27, perPage: 10 },
    });
  });

  it('forwards the requested page to the catalog', async () => {
    const { sessionToken } = await createTestSession('master-versions-page-user');

    discogsScope()
      .get('/masters/1660109/versions')
      .query({ page: '2', per_page: '10' })
      .reply(200, {
        pagination: { page: 2, pages: 3, items: 27, per_page: 10 },
        versions: [],
      });

    const res = await request(app)
      .get('/api/discogs/masters/1660109/versions')
      .query({ page: '2' })
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
  });

  it('returns 404 master_not_found when Discogs has no master for that ID', async () => {
    const { sessionToken } = await createTestSession('master-versions-notfound-user');

    discogsScope()
      .get('/masters/999999999/versions')
      .query({ page: '1', per_page: '10' })
      .reply(404, { message: 'Master not found' });

    const res = await request(app)
      .get('/api/discogs/masters/999999999/versions')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('master_not_found');
  });
});

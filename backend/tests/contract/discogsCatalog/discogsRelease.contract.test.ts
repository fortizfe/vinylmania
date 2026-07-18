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

const rawRelease = {
  id: 1,
  title: 'Stockholm',
  year: 1999,
  released: '1999-05-01',
  notes: 'Recorded at Stockholm Sound Studio.',
  artists: [{ id: 1, name: 'The Persuader', anv: '', join: '', role: '' }],
  labels: [{ id: 5, name: 'Svek', catno: 'SK032' }],
  formats: [{ name: 'Vinyl', qty: '2', descriptions: ['12"'] }],
  genres: ['Electronic'],
  styles: ['Deep House'],
  identifiers: [{ type: 'Barcode', value: '7 39051 23421 6' }],
  community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
  tracklist: [{ position: 'A', type_: 'track', title: 'Östermalm', duration: '4:45' }],
  images: [],
  uri: 'https://www.discogs.com/release/1-The-Persuader-Stockholm',
};

describe('Discogs release preview API contract: GET /api/discogs/releases/:discogsId', () => {
  beforeAll(() => {
    // Deterministic behavior regardless of a local Redis: the success and
    // rate-limit tests below reuse release ID 1, which a real cache-aside
    // hit would otherwise short-circuit.
    delete process.env.REDIS_URL;
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('signs the request with the linked user OAuth token when the caller has an active connection (spec 053, US1)', async () => {
    const { sessionToken, uid } = await createTestSession('preview-linked-user');
    await linkDiscogs(uid);
    discogsScope()
      .get('/releases/2001')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, { ...rawRelease, id: 2001 });

    const res = await request(app)
      .get('/api/discogs/releases/2001')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.discogsId).toBe(2001);
  });

  it('signs the request with DISCOGS_TOKEN when the caller has no linked account (spec 053, US2)', async () => {
    const { sessionToken } = await createTestSession('preview-unlinked-user');
    discogsScope()
      .get('/releases/2002')
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(200, { ...rawRelease, id: 2002 });

    const res = await request(app)
      .get('/api/discogs/releases/2002')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.discogsId).toBe(2002);
  });

  it('switches from DISCOGS_TOKEN to the OAuth token as soon as the account is linked mid-session, no re-login required (spec 053, US1 edge case)', async () => {
    const { sessionToken, uid } = await createTestSession('preview-midlink-user');

    discogsScope()
      .get('/releases/2003')
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(200, { ...rawRelease, id: 2003 });
    const firstRes = await request(app)
      .get('/api/discogs/releases/2003')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(firstRes.status).toBe(200);

    await linkDiscogs(uid);

    discogsScope()
      .get('/releases/2004')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, { ...rawRelease, id: 2004 });
    const secondRes = await request(app)
      .get('/api/discogs/releases/2004')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.discogsId).toBe(2004);
  });

  it('returns 401 discogs_link_invalid, without ever calling the vinylmania-token stub, when the linked account is revoked (spec 053, US3)', async () => {
    const { sessionToken, uid } = await createTestSession('preview-revoked-user');
    await linkDiscogs(uid);
    const oauthScope = discogsScope()
      .get('/releases/2005')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(401, { message: 'unauthorized' });
    const appTokenScope = discogsScope()
      .get('/releases/2005')
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(200, { ...rawRelease, id: 2005 });

    const res = await request(app)
      .get('/api/discogs/releases/2005')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'discogs_link_invalid',
      message: 'Your Discogs link is no longer valid. Please re-link your account from your profile.',
    });
    expect(oauthScope.isDone()).toBe(true);
    // The load-bearing assertion for FR-004: the vinylmania-token stub was
    // never consumed — no silent fallback occurred.
    expect(appTokenScope.isDone()).toBe(false);
  });

  it('falls through to 500 internal_error (not discogs_link_invalid) when DISCOGS_TOKEN itself is rejected for an unlinked user (spec 053, mis-attribution guard)', async () => {
    const { sessionToken } = await createTestSession('preview-badtoken-user');
    discogsScope()
      .get('/releases/2006')
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(401, { message: 'unauthorized' });

    const res = await request(app)
      .get('/api/discogs/releases/2006')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_error');
  });

  it('returns the full release for an authenticated caller', async () => {
    const { sessionToken } = await createTestSession('preview-user');
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .get('/api/discogs/releases/1')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      discogsId: 1,
      title: 'Stockholm',
      year: 1999,
      releaseDate: '1999-05-01',
      notes: 'Recorded at Stockholm Sound Studio.',
      artists: [expect.objectContaining({ discogsArtistId: 1, name: 'The Persuader' })],
      identifiers: [
        expect.objectContaining({ type: 'Barcode', value: '7 39051 23421 6' }),
      ],
      community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
      tracklist: [expect.objectContaining({ position: 'A', title: 'Östermalm' })],
    });
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/discogs/releases/1');

    expect(res.status).toBe(401);
  });

  it('returns 404 release_not_found when the release does not exist', async () => {
    const { sessionToken } = await createTestSession('preview-notfound-user');
    discogsScope().get('/releases/999999999').reply(404, { message: 'not found' });

    const res = await request(app)
      .get('/api/discogs/releases/999999999')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('release_not_found');
  });

  it('returns 502 catalog_unavailable when Discogs is rate-limited', async () => {
    const { sessionToken } = await createTestSession('preview-ratelimit-user');
    discogsScope()
      .get('/releases/1')
      .times(MAX_ATTEMPTS)
      .reply(429, { message: 'too many requests' });

    const res = await request(app)
      .get('/api/discogs/releases/1')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('catalog_unavailable');
  });
});

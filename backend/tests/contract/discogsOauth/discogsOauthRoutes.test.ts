import nock from 'nock';
import request from 'supertest';

import { createApp } from '../../../src/app';
import { getFirestoreDb } from '../../../src/config/firebase-admin';
import { clearEmulatorFirestore, clearEmulatorUsers } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';
import { discogsScope } from '../../helpers/nock';

const app = createApp();

const REQUEST_TOKEN_BODY =
  'oauth_token=req-tok&oauth_token_secret=req-sec&oauth_callback_confirmed=true';
const ACCESS_TOKEN_BODY = 'oauth_token=acc-tok&oauth_token_secret=acc-sec';
const IDENTITY_BODY = { id: 99, username: 'discogs-jane' };
const NATIVE_CALLBACK_URL = 'https://backend.test/api/discogs/oauth/native/callback';
const URLENCODED = { 'Content-Type': 'application/x-www-form-urlencoded' };

async function seedConnection(uid: string): Promise<void> {
  await getFirestoreDb()
    .collection('discogsConnections')
    .doc(uid)
    .set({
      uid,
      discogsUsername: 'existing-user',
      discogsUserId: 1,
      accessToken: 'stored-token',
      accessTokenSecret: 'stored-secret',
      linkedAt: new Date('2026-07-01T10:00:00Z'),
    });
}

describe('Discogs OAuth API contract', () => {
  beforeAll(() => {
    process.env.DISCOGS_CONSUMER_KEY = 'contract-test-key';
    process.env.DISCOGS_CONSUMER_SECRET = 'contract-test-secret';
    process.env.DISCOGS_OAUTH_CALLBACK_URL =
      'http://localhost:5173/app/profile/discogs/callback';
    process.env.DISCOGS_OAUTH_NATIVE_CALLBACK_URL = NATIVE_CALLBACK_URL;
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  describe('POST /api/discogs/oauth/request', () => {
    it('returns 200 with an authorizeUrl containing the request token', async () => {
      const { sessionToken } = await createTestSession('oauth-request-ok');
      discogsScope()
        .get('/oauth/request_token')
        .reply(200, REQUEST_TOKEN_BODY, URLENCODED);

      const res = await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(['authorizeUrl']);
      expect(res.body.authorizeUrl).toContain('oauth_token=req-tok');
    });

    it('sends the native oauth_callback for {client: "native"}', async () => {
      const { sessionToken } = await createTestSession('oauth-request-native');
      const scope = discogsScope()
        .get('/oauth/request_token')
        .matchHeader('authorization', (value: string) =>
          value.includes(`oauth_callback="${NATIVE_CALLBACK_URL}"`),
        )
        .reply(200, REQUEST_TOKEN_BODY, URLENCODED);

      const res = await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ client: 'native' });

      expect(res.status).toBe(200);
      expect(res.body.authorizeUrl).toContain('oauth_token=req-tok');
      expect(scope.isDone()).toBe(true);
    });

    it('returns 500 internal_error without calling Discogs when the native callback is not configured', async () => {
      const { sessionToken } = await createTestSession('oauth-request-native-unset');
      const scope = discogsScope().get('/oauth/request_token').reply(200, REQUEST_TOKEN_BODY, URLENCODED);
      delete process.env.DISCOGS_OAUTH_NATIVE_CALLBACK_URL;

      try {
        const res = await request(app)
          .post('/api/discogs/oauth/request')
          .set('Authorization', `Bearer ${sessionToken}`)
          .send({ client: 'native' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('internal_error');
        expect(scope.isDone()).toBe(false);
      } finally {
        process.env.DISCOGS_OAUTH_NATIVE_CALLBACK_URL = NATIVE_CALLBACK_URL;
        nock.cleanAll();
      }
    });

    it('returns 400 validation_error for an unknown client', async () => {
      const { sessionToken } = await createTestSession('oauth-request-badclient');

      const res = await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ client: 'desktop' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('returns 401 without a bearer token', async () => {
      const res = await request(app).post('/api/discogs/oauth/request');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 409 already_connected when a connection exists', async () => {
      const { sessionToken, uid } = await createTestSession('oauth-request-conflict');
      await seedConnection(uid);

      const res = await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('already_connected');
    });
  });

  describe('GET /api/discogs/oauth/native/callback', () => {
    it('relays only oauth_token, oauth_verifier and denied to the app callback, without auth', async () => {
      const res = await request(app)
        .get('/api/discogs/oauth/native/callback')
        .query({ oauth_token: 'req-tok', oauth_verifier: 'the-verifier', foo: 'bar' });

      expect(res.status).toBe(302);
      const location = new URL(res.headers.location);
      expect(`${location.protocol}//${location.host}${location.pathname}`).toBe(
        'vinylmania://discogs/callback',
      );
      expect(Object.fromEntries(location.searchParams)).toEqual({
        oauth_token: 'req-tok',
        oauth_verifier: 'the-verifier',
      });
    });

    it('relays denied', async () => {
      const res = await request(app)
        .get('/api/discogs/oauth/native/callback')
        .query({ denied: 'req-tok' });

      expect(res.status).toBe(302);
      expect(Object.fromEntries(new URL(res.headers.location).searchParams)).toEqual({
        denied: 'req-tok',
      });
    });
  });

  describe('POST /api/discogs/oauth/complete', () => {
    it('returns 200 with the ConnectionStatus DTO on the happy path', async () => {
      const { sessionToken } = await createTestSession('oauth-complete-ok');
      discogsScope()
        .get('/oauth/request_token')
        .reply(200, REQUEST_TOKEN_BODY, URLENCODED);
      discogsScope()
        .post('/oauth/access_token')
        .reply(200, ACCESS_TOKEN_BODY, URLENCODED);
      discogsScope().get('/oauth/identity').reply(200, IDENTITY_BODY);

      await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${sessionToken}`);

      const res = await request(app)
        .post('/api/discogs/oauth/complete')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ oauthToken: 'req-tok', oauthVerifier: 'the-verifier' });

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual([
        'connected',
        'discogsUsername',
        'linkedAt',
      ]);
      expect(res.body.connected).toBe(true);
      expect(res.body.discogsUsername).toBe('discogs-jane');
      expect(new Date(res.body.linkedAt).getTime()).not.toBeNaN();
    });

    it('returns 400 validation_error on a malformed body', async () => {
      const { sessionToken } = await createTestSession('oauth-complete-badbody');

      const res = await request(app)
        .post('/api/discogs/oauth/complete')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ oauthToken: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('returns 401 without a bearer token', async () => {
      const res = await request(app)
        .post('/api/discogs/oauth/complete')
        .send({ oauthToken: 'req-tok', oauthVerifier: 'v' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 409 already_connected when a connection exists', async () => {
      const { sessionToken, uid } = await createTestSession('oauth-complete-conflict');
      await seedConnection(uid);

      const res = await request(app)
        .post('/api/discogs/oauth/complete')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ oauthToken: 'req-tok', oauthVerifier: 'v' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('already_connected');
    });
  });

  describe('failure mapping (US3)', () => {
    it('maps a Discogs 429 to 429 discogs_rate_limited on /request', async () => {
      const { sessionToken } = await createTestSession('oauth-request-429');
      discogsScope().get('/oauth/request_token').reply(429, 'slow down');

      const res = await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('discogs_rate_limited');
    });

    it('maps a Discogs outage to 503 discogs_unavailable on /request', async () => {
      const { sessionToken } = await createTestSession('oauth-request-503');
      discogsScope().get('/oauth/request_token').reply(500, 'boom');

      const res = await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('discogs_unavailable');
    });

    it('answers 400 invalid_request for an unknown/tampered token on /complete', async () => {
      const { sessionToken } = await createTestSession('oauth-complete-tampered');

      const res = await request(app)
        .post('/api/discogs/oauth/complete')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ oauthToken: 'forged-token', oauthVerifier: 'forged-verifier' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    });

    it('answers 400 expired_request when the pending attempt is past its window on /complete', async () => {
      const { sessionToken, uid } = await createTestSession('oauth-complete-expired');
      await getFirestoreDb()
        .collection('discogsOAuthRequests')
        .doc('old-tok')
        .set({
          uid,
          requestTokenSecret: 'req-sec',
          createdAt: new Date(Date.now() - 20 * 60 * 1000),
          expiresAt: new Date(Date.now() - 5 * 60 * 1000),
        });

      const res = await request(app)
        .post('/api/discogs/oauth/complete')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ oauthToken: 'old-tok', oauthVerifier: 'v' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('expired_request');
    });
  });

  describe('DELETE /api/discogs/oauth/connection', () => {
    it('returns 204 and removes the stored connection', async () => {
      const { sessionToken, uid } = await createTestSession('oauth-disconnect-ok');
      await seedConnection(uid);

      const res = await request(app)
        .delete('/api/discogs/oauth/connection')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(204);
      const snapshot = await getFirestoreDb()
        .collection('discogsConnections')
        .doc(uid)
        .get();
      expect(snapshot.exists).toBe(false);
    });

    it('returns 204 when no connection exists (idempotent)', async () => {
      const { sessionToken } = await createTestSession('oauth-disconnect-idempotent');

      const res = await request(app)
        .delete('/api/discogs/oauth/connection')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(204);
    });

    it('returns 401 without a bearer token', async () => {
      const res = await request(app).delete('/api/discogs/oauth/connection');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });
  });

  describe('GET /api/discogs/oauth/status', () => {
    it('returns connected:false with no other keys when nothing is stored', async () => {
      const { sessionToken } = await createTestSession('oauth-status-empty');

      const res = await request(app)
        .get('/api/discogs/oauth/status')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ connected: false });
    });

    it('returns EXACTLY the ConnectionStatus DTO keys when connected — never token fields', async () => {
      const { sessionToken, uid } = await createTestSession('oauth-status-connected');
      await seedConnection(uid);

      const res = await request(app)
        .get('/api/discogs/oauth/status')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual([
        'connected',
        'discogsUsername',
        'linkedAt',
      ]);
      expect(res.body).toMatchObject({
        connected: true,
        discogsUsername: 'existing-user',
      });
      expect(JSON.stringify(res.body)).not.toContain('stored-token');
      expect(JSON.stringify(res.body)).not.toContain('stored-secret');
    });

    it('returns 401 without a bearer token', async () => {
      const res = await request(app).get('/api/discogs/oauth/status');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });
  });
});

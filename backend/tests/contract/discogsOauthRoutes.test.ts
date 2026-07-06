import request from 'supertest';

import { createApp } from '../../src/app';
import { getFirestoreDb } from '../../src/config/firebase-admin';
import { clearEmulatorFirestore, clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';
import { discogsScope } from '../helpers/nock';

const app = createApp();

const REQUEST_TOKEN_BODY =
  'oauth_token=req-tok&oauth_token_secret=req-sec&oauth_callback_confirmed=true';
const ACCESS_TOKEN_BODY = 'oauth_token=acc-tok&oauth_token_secret=acc-sec';
const IDENTITY_BODY = { id: 99, username: 'discogs-jane' };
const URLENCODED = { 'Content-Type': 'application/x-www-form-urlencoded' };

async function seedConnection(uid: string): Promise<void> {
  await getFirestoreDb().collection('discogsConnections').doc(uid).set({
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
    process.env.DISCOGS_OAUTH_CALLBACK_URL = 'http://localhost:5173/app/profile/discogs/callback';
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  describe('POST /api/discogs/oauth/request', () => {
    it('returns 200 with an authorizeUrl containing the request token', async () => {
      const { idToken } = await getTestIdToken('oauth-request-ok');
      discogsScope().get('/oauth/request_token').reply(200, REQUEST_TOKEN_BODY, URLENCODED);

      const res = await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(['authorizeUrl']);
      expect(res.body.authorizeUrl).toContain('oauth_token=req-tok');
    });

    it('returns 401 without a bearer token', async () => {
      const res = await request(app).post('/api/discogs/oauth/request');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 409 already_connected when a connection exists', async () => {
      const { idToken, uid } = await getTestIdToken('oauth-request-conflict');
      await seedConnection(uid);

      const res = await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('already_connected');
    });
  });

  describe('POST /api/discogs/oauth/complete', () => {
    it('returns 200 with the ConnectionStatus DTO on the happy path', async () => {
      const { idToken } = await getTestIdToken('oauth-complete-ok');
      discogsScope().get('/oauth/request_token').reply(200, REQUEST_TOKEN_BODY, URLENCODED);
      discogsScope().post('/oauth/access_token').reply(200, ACCESS_TOKEN_BODY, URLENCODED);
      discogsScope().get('/oauth/identity').reply(200, IDENTITY_BODY);

      await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${idToken}`);

      const res = await request(app)
        .post('/api/discogs/oauth/complete')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ oauthToken: 'req-tok', oauthVerifier: 'the-verifier' });

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['connected', 'discogsUsername', 'linkedAt']);
      expect(res.body.connected).toBe(true);
      expect(res.body.discogsUsername).toBe('discogs-jane');
      expect(new Date(res.body.linkedAt).getTime()).not.toBeNaN();
    });

    it('returns 400 validation_error on a malformed body', async () => {
      const { idToken } = await getTestIdToken('oauth-complete-badbody');

      const res = await request(app)
        .post('/api/discogs/oauth/complete')
        .set('Authorization', `Bearer ${idToken}`)
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
      const { idToken, uid } = await getTestIdToken('oauth-complete-conflict');
      await seedConnection(uid);

      const res = await request(app)
        .post('/api/discogs/oauth/complete')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ oauthToken: 'req-tok', oauthVerifier: 'v' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('already_connected');
    });
  });

  describe('failure mapping (US3)', () => {
    it('maps a Discogs 429 to 429 discogs_rate_limited on /request', async () => {
      const { idToken } = await getTestIdToken('oauth-request-429');
      discogsScope().get('/oauth/request_token').reply(429, 'slow down');

      const res = await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('discogs_rate_limited');
    });

    it('maps a Discogs outage to 503 discogs_unavailable on /request', async () => {
      const { idToken } = await getTestIdToken('oauth-request-503');
      discogsScope().get('/oauth/request_token').reply(500, 'boom');

      const res = await request(app)
        .post('/api/discogs/oauth/request')
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('discogs_unavailable');
    });

    it('answers 400 invalid_request for an unknown/tampered token on /complete', async () => {
      const { idToken } = await getTestIdToken('oauth-complete-tampered');

      const res = await request(app)
        .post('/api/discogs/oauth/complete')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ oauthToken: 'forged-token', oauthVerifier: 'forged-verifier' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    });

    it('answers 400 expired_request when the pending attempt is past its window on /complete', async () => {
      const { idToken, uid } = await getTestIdToken('oauth-complete-expired');
      await getFirestoreDb().collection('discogsOAuthRequests').doc('old-tok').set({
        uid,
        requestTokenSecret: 'req-sec',
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
        expiresAt: new Date(Date.now() - 5 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/discogs/oauth/complete')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ oauthToken: 'old-tok', oauthVerifier: 'v' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('expired_request');
    });
  });

  describe('DELETE /api/discogs/oauth/connection', () => {
    it('returns 204 and removes the stored connection', async () => {
      const { idToken, uid } = await getTestIdToken('oauth-disconnect-ok');
      await seedConnection(uid);

      const res = await request(app)
        .delete('/api/discogs/oauth/connection')
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(204);
      const snapshot = await getFirestoreDb().collection('discogsConnections').doc(uid).get();
      expect(snapshot.exists).toBe(false);
    });

    it('returns 204 when no connection exists (idempotent)', async () => {
      const { idToken } = await getTestIdToken('oauth-disconnect-idempotent');

      const res = await request(app)
        .delete('/api/discogs/oauth/connection')
        .set('Authorization', `Bearer ${idToken}`);

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
      const { idToken } = await getTestIdToken('oauth-status-empty');

      const res = await request(app)
        .get('/api/discogs/oauth/status')
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ connected: false });
    });

    it('returns EXACTLY the ConnectionStatus DTO keys when connected — never token fields', async () => {
      const { idToken, uid } = await getTestIdToken('oauth-status-connected');
      await seedConnection(uid);

      const res = await request(app)
        .get('/api/discogs/oauth/status')
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['connected', 'discogsUsername', 'linkedAt']);
      expect(res.body).toMatchObject({ connected: true, discogsUsername: 'existing-user' });
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

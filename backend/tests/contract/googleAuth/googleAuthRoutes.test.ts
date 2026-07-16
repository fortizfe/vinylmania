import nock from 'nock';
import request from 'supertest';

import { createApp } from '../../../src/app';
import { getFirestoreDb } from '../../../src/config/firebase-admin';
import { clearEmulatorFirestore, clearEmulatorUsers } from '../../helpers/authEmulator';

const app = createApp();

const GOOGLE_OAUTH_BASE_URL = 'https://google-oauth.test';
const GOOGLE_TOKEN_BASE_URL = 'https://google-token.test';
const GOOGLE_USERINFO_BASE_URL = 'https://google-userinfo.test';

function googleTokenScope(): nock.Scope {
  return nock(GOOGLE_TOKEN_BASE_URL);
}

function googleUserinfoScope(): nock.Scope {
  return nock(GOOGLE_USERINFO_BASE_URL);
}

async function seedPendingLogin(state: string, expiresAt: Date) {
  await getFirestoreDb()
    .collection('pendingGoogleLogins')
    .doc(state)
    .set({ createdAt: new Date(), expiresAt });
}

describe('Google login API contract', () => {
  beforeAll(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'contract-test-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'contract-test-client-secret';
    process.env.GOOGLE_OAUTH_CALLBACK_URL = 'http://localhost:5173/login/callback';
    process.env.GOOGLE_OAUTH_BASE_URL = GOOGLE_OAUTH_BASE_URL;
    process.env.GOOGLE_TOKEN_BASE_URL = GOOGLE_TOKEN_BASE_URL;
    process.env.GOOGLE_USERINFO_BASE_URL = GOOGLE_USERINFO_BASE_URL;
    nock.disableNetConnect();
    nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'));
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  afterEach(async () => {
    nock.cleanAll();
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  describe('GET /api/auth/google/authorize', () => {
    it('redirects to the Google authorize endpoint with a fresh state', async () => {
      const res = await request(app).get('/api/auth/google/authorize');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(GOOGLE_OAUTH_BASE_URL);
      expect(res.headers.location).toContain('client_id=contract-test-client-id');
      expect(res.headers.location).toMatch(/state=[^&]+/);
    });
  });

  describe('POST /api/auth/google/complete', () => {
    it('returns 200 with a sessionToken and user profile on the happy path', async () => {
      const authorizeRes = await request(app).get('/api/auth/google/authorize');
      const state = new URL(authorizeRes.headers.location).searchParams.get('state')!;

      googleTokenScope()
        .post('/token')
        .reply(200, { access_token: 'google-access-token', token_type: 'Bearer', expires_in: 3600 });
      googleUserinfoScope()
        .get('/v1/userinfo')
        .matchHeader('authorization', 'Bearer google-access-token')
        .reply(200, {
          sub: 'google-sub-1',
          email: 'jane@example.com',
          name: 'Jane Doe',
          picture: 'https://example.com/p.png',
        });

      const res = await request(app)
        .post('/api/auth/google/complete')
        .send({ code: 'auth-code', state });

      expect(res.status).toBe(200);
      expect(res.body.sessionToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email: 'jane@example.com', displayName: 'Jane Doe' });
    });

    it('returns 400 validation_error on a malformed body', async () => {
      const res = await request(app).post('/api/auth/google/complete').send({ code: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('returns 400 denied when Google reports access_denied', async () => {
      const res = await request(app)
        .post('/api/auth/google/complete')
        .send({ error: 'access_denied', state: 'irrelevant-state' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('denied');
    });

    it('returns 400 invalid_state for an unknown state', async () => {
      const res = await request(app)
        .post('/api/auth/google/complete')
        .send({ code: 'auth-code', state: 'never-issued' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_state');
    });

    it('returns 400 expired_state when the pending login is past its window', async () => {
      await seedPendingLogin('expired-state', new Date(Date.now() - 60_000));

      const res = await request(app)
        .post('/api/auth/google/complete')
        .send({ code: 'auth-code', state: 'expired-state' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('expired_state');
    });

    it('returns 502 exchange_failed when the token exchange fails', async () => {
      const authorizeRes = await request(app).get('/api/auth/google/authorize');
      const state = new URL(authorizeRes.headers.location).searchParams.get('state')!;
      googleTokenScope().post('/token').reply(500, { error: 'server_error' });

      const res = await request(app)
        .post('/api/auth/google/complete')
        .send({ code: 'auth-code', state });

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('exchange_failed');
    });
  });
});

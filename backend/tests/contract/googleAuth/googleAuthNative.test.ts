import nock from 'nock';
import request from 'supertest';

import { createApp } from '../../../src/app';
import { getFirestoreDb } from '../../../src/config/firebase-admin';
import { clearEmulatorFirestore, clearEmulatorUsers } from '../../helpers/authEmulator';

// Native (Flutter app) Google sign-in: contracts/native-oauth-api.md (feature 070).
// Own file so it gets its own strict rate-limit budget (20/min per router).
const app = createApp();

const GOOGLE_OAUTH_BASE_URL = 'https://google-oauth.test';
const GOOGLE_TOKEN_BASE_URL = 'https://google-token.test';
const GOOGLE_USERINFO_BASE_URL = 'https://google-userinfo.test';
const NATIVE_CALLBACK_URL = 'https://backend.test/api/auth/google/native/callback';

// RFC 7636 Appendix B
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

async function startNativeLogin(): Promise<string> {
  const res = await request(app)
    .get('/api/auth/google/authorize')
    .query({ client: 'native', code_challenge: CHALLENGE });
  return new URL(res.headers.location).searchParams.get('state')!;
}

describe('Google native login API contract', () => {
  beforeAll(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'contract-test-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'contract-test-client-secret';
    process.env.GOOGLE_OAUTH_CALLBACK_URL = 'http://localhost:5173/login/callback';
    process.env.GOOGLE_OAUTH_NATIVE_CALLBACK_URL = NATIVE_CALLBACK_URL;
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
    // Requests are budgeted: the strict limiter allows 20/min for this whole file (shared via Redis locally).
    it('uses the native redirect_uri and forwards the PKCE challenge to Google for client=native', async () => {
      const res = await request(app)
        .get('/api/auth/google/authorize')
        .query({ client: 'native', code_challenge: CHALLENGE });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(GOOGLE_OAUTH_BASE_URL);
      const params = new URL(res.headers.location).searchParams;
      expect(params.get('redirect_uri')).toBe(NATIVE_CALLBACK_URL);
      expect(params.get('code_challenge')).toBe(CHALLENGE);
      expect(params.get('code_challenge_method')).toBe('S256');
    });

    it.each([
      ['native without code_challenge', { client: 'native' }],
      ['native with a malformed code_challenge', { client: 'native', code_challenge: 'too-short' }],
      ['web with a code_challenge', { client: 'web', code_challenge: CHALLENGE }],
      ['an unknown client', { client: 'desktop' }],
    ])('returns 400 validation_error for %s', async (_label, query) => {
      const res = await request(app).get('/api/auth/google/authorize').query(query);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'validation_error',
        message: 'The sign-in request is malformed.',
      });
    });
  });

  describe('GET /api/auth/google/native/callback', () => {
    it('relays only code and state to the app callback (extra params dropped)', async () => {
      const res = await request(app)
        .get('/api/auth/google/native/callback')
        .query({ code: 'auth-code', state: 'the-state', foo: 'bar' });

      expect(res.status).toBe(302);
      const location = new URL(res.headers.location);
      expect(`${location.protocol}//${location.host}${location.pathname}`).toBe(
        'vinylmania://auth/callback',
      );
      expect(Object.fromEntries(location.searchParams)).toEqual({
        code: 'auth-code',
        state: 'the-state',
      });
    });

    it('relays an error with its state', async () => {
      const res = await request(app)
        .get('/api/auth/google/native/callback')
        .query({ error: 'access_denied', state: 'the-state' });

      expect(res.status).toBe(302);
      expect(Object.fromEntries(new URL(res.headers.location).searchParams)).toEqual({
        error: 'access_denied',
        state: 'the-state',
      });
    });

    it('returns 400 validation_error without a state', async () => {
      const res = await request(app)
        .get('/api/auth/google/native/callback')
        .query({ code: 'auth-code' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });
  });

  describe('POST /api/auth/google/complete', () => {
    it('returns 200 with a matching codeVerifier and exchanges it with Google on the native redirect_uri', async () => {
      const state = await startNativeLogin();
      const tokenScope = nock(GOOGLE_TOKEN_BASE_URL)
        .post(
          '/token',
          (body) => body.redirect_uri === NATIVE_CALLBACK_URL && body.code_verifier === VERIFIER,
        )
        .reply(200, { access_token: 'google-access-token', token_type: 'Bearer', expires_in: 3600 });
      nock(GOOGLE_USERINFO_BASE_URL)
        .get('/v1/userinfo')
        .reply(200, { sub: 'google-sub-2', email: 'native@example.com', name: 'Native User' });

      const res = await request(app)
        .post('/api/auth/google/complete')
        .send({ code: 'auth-code', state, codeVerifier: VERIFIER });

      expect(res.status).toBe(200);
      expect(res.body.sessionToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email: 'native@example.com' });
      expect(tokenScope.isDone()).toBe(true);
    });

    it.each([
      ['a missing', undefined],
      ['a wrong', 'A'.repeat(43)],
    ])('returns 400 invalid_state with %s codeVerifier and keeps the pending login', async (_label, codeVerifier) => {
      const state = await startNativeLogin();

      const res = await request(app)
        .post('/api/auth/google/complete')
        .send({ code: 'auth-code', state, codeVerifier });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'invalid_state',
        message: 'This sign-in attempt is not valid. Please try signing in again.',
      });
      const pending = await getFirestoreDb().collection('pendingGoogleLogins').doc(state).get();
      expect(pending.exists).toBe(true);
    });

    it('returns 400 validation_error for a malformed codeVerifier', async () => {
      const res = await request(app)
        .post('/api/auth/google/complete')
        .send({ code: 'auth-code', state: 'any', codeVerifier: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('sends no PKCE to Google and ignores a codeVerifier on a web login', async () => {
      const webAuthorize = await request(app).get('/api/auth/google/authorize');
      const authorizeParams = new URL(webAuthorize.headers.location).searchParams;
      expect(authorizeParams.has('code_challenge')).toBe(false);
      expect(authorizeParams.has('code_challenge_method')).toBe(false);
      const state = authorizeParams.get('state')!;
      nock(GOOGLE_TOKEN_BASE_URL)
        .post(
          '/token',
          (body) =>
            body.redirect_uri === 'http://localhost:5173/login/callback' &&
            body.code_verifier === undefined,
        )
        .reply(200, { access_token: 'google-access-token', token_type: 'Bearer', expires_in: 3600 });
      nock(GOOGLE_USERINFO_BASE_URL)
        .get('/v1/userinfo')
        .reply(200, { sub: 'google-sub-3', email: 'web@example.com', name: 'Web User' });

      const res = await request(app)
        .post('/api/auth/google/complete')
        .send({ code: 'auth-code', state, codeVerifier: VERIFIER });

      expect(res.status).toBe(200);
    });
  });
});

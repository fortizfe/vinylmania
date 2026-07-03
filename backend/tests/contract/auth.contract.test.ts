import request from 'supertest';

import { createApp } from '../../src/app';
import { clearEmulatorFirestore, clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';

const app = createApp();

describe('Auth API contract', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  describe('POST /api/auth/session', () => {
    it('returns 200 with the user profile for a valid token', async () => {
      const { idToken, uid } = await getTestIdToken('session-valid', {
        displayName: 'Jane Doe',
      });

      const res = await request(app)
        .post('/api/auth/session')
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        uid,
        displayName: 'Jane Doe',
      });
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.lastSignInAt).toBeDefined();
    });

    it('returns 401 when no Authorization header is sent', async () => {
      const res = await request(app).post('/api/auth/session');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 401 for an invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/session')
        .set('Authorization', 'Bearer garbage-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 200 with the existing profile after a session has been established', async () => {
      const { idToken } = await getTestIdToken('me-valid', { displayName: 'Jane Doe' });
      await request(app).post('/api/auth/session').set('Authorization', `Bearer ${idToken}`);

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe('Jane Doe');
    });

    it('returns 401 when no profile exists yet for the token', async () => {
      const { idToken } = await getTestIdToken('me-no-profile');

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(401);
    });

    it('returns 401 when no Authorization header is sent', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });
  });
});

import request from 'supertest';

import { createApp } from '../../../src/app';
import { firestoreUserRepository } from '../../../src/adapters/users/firestoreUserRepository';
import { clearEmulatorFirestore } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

const app = createApp();

async function seedProfile(uid: string, displayName = 'Jane Doe') {
  await firestoreUserRepository.create({
    uid,
    displayName,
    email: `${uid}@example.com`,
  });
}

describe('Auth session API contract', () => {
  afterEach(async () => {
    await clearEmulatorFirestore();
  });

  describe('GET /api/auth/me', () => {
    it('returns 200 with the existing profile for a valid session', async () => {
      const { sessionToken, uid } = await createTestSession('me-valid');
      await seedProfile(uid, 'Jane Doe');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe('Jane Doe');
    });

    it('returns 401 when no profile exists yet for the session', async () => {
      const { sessionToken } = await createTestSession('me-no-profile');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(401);
    });

    it('returns 401 when no Authorization header is sent', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/auth/session', () => {
    it('returns 204 and revokes the session — a subsequent request with the same token is unauthorized', async () => {
      const { sessionToken, uid } = await createTestSession('logout-user');
      await seedProfile(uid);

      const res = await request(app)
        .delete('/api/auth/session')
        .set('Authorization', `Bearer ${sessionToken}`);
      expect(res.status).toBe(204);

      const after = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${sessionToken}`);
      expect(after.status).toBe(401);
    });

    it('a repeat call with the same (now-revoked) token is unauthorized, not a 500 — the token itself is the resource being revoked, so it cannot re-authenticate a second delete', async () => {
      const { sessionToken } = await createTestSession('logout-idempotent-user');

      const first = await request(app)
        .delete('/api/auth/session')
        .set('Authorization', `Bearer ${sessionToken}`);
      expect(first.status).toBe(204);

      const second = await request(app)
        .delete('/api/auth/session')
        .set('Authorization', `Bearer ${sessionToken}`);
      expect(second.status).toBe(401);
    });

    it('revoking one session does not affect a second session for the same uid (per-device isolation)', async () => {
      const deviceA = await createTestSession('multi-device-user');
      const deviceB = await createTestSession('multi-device-user');
      await seedProfile('multi-device-user');

      await request(app)
        .delete('/api/auth/session')
        .set('Authorization', `Bearer ${deviceA.sessionToken}`);

      const stillWorks = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${deviceB.sessionToken}`);
      expect(stillWorks.status).toBe(200);
    });

    it('returns 401 when no Authorization header is sent', async () => {
      const res = await request(app).delete('/api/auth/session');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });
  });
});

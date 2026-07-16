import request from 'supertest';

import { createApp } from '../../../src/app';
import { firestoreUserRepository } from '../../../src/adapters/users/firestoreUserRepository';
import { clearEmulatorFirestore } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

const app = createApp();

async function seedProfile(uid: string, displayName = 'Jane Doe') {
  return firestoreUserRepository.create({
    uid,
    displayName,
    email: `${uid}@example.com`,
  });
}

describe('PATCH /api/auth/preferences', () => {
  afterEach(async () => {
    await clearEmulatorFirestore();
  });

  it('returns 200 for a valid value and the value round-trips through GET /api/auth/me', async () => {
    const { sessionToken, uid } = await createTestSession('prefs-valid');
    await seedProfile(uid);

    const patchRes = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ themePreference: 'dark' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.themePreference).toBe('dark');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.themePreference).toBe('dark');
  });

  it('returns 400 when themePreference is missing', async () => {
    const { sessionToken, uid } = await createTestSession('prefs-missing');
    await seedProfile(uid);

    const res = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 400 when themePreference is not "light" or "dark"', async () => {
    const { sessionToken, uid } = await createTestSession('prefs-invalid');
    await seedProfile(uid);

    const res = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ themePreference: 'blue' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 401 without a bearer token', async () => {
    const res = await request(app)
      .patch('/api/auth/preferences')
      .send({ themePreference: 'dark' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('a preferences-only write leaves every other UserProfile field untouched', async () => {
    const { sessionToken, uid } = await createTestSession('prefs-isolated');
    const seeded = await seedProfile(uid);

    const patchRes = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ themePreference: 'light' });

    expect(patchRes.body.displayName).toBe(seeded.displayName);
    expect(patchRes.body.email).toBe(seeded.email);
    expect(patchRes.body.uid).toBe(seeded.uid);
    expect(patchRes.body.createdAt).toBe(seeded.createdAt);
  });
});

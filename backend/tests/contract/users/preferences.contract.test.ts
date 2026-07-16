import request from 'supertest';

import { createApp } from '../../../src/app';
import {
  clearEmulatorFirestore,
  clearEmulatorUsers,
  getTestIdToken,
} from '../../helpers/authEmulator';

const app = createApp();

describe('PATCH /api/auth/preferences', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('returns 200 for a valid value and the value round-trips through GET /api/auth/me', async () => {
    const { idToken } = await getTestIdToken('prefs-valid', { displayName: 'Jane Doe' });
    await request(app).post('/api/auth/session').set('Authorization', `Bearer ${idToken}`);

    const patchRes = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ themePreference: 'dark' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.themePreference).toBe('dark');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${idToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.themePreference).toBe('dark');
  });

  it('returns 400 when themePreference is missing', async () => {
    const { idToken } = await getTestIdToken('prefs-missing', { displayName: 'Jane Doe' });
    await request(app).post('/api/auth/session').set('Authorization', `Bearer ${idToken}`);

    const res = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${idToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 400 when themePreference is not "light" or "dark"', async () => {
    const { idToken } = await getTestIdToken('prefs-invalid', { displayName: 'Jane Doe' });
    await request(app).post('/api/auth/session').set('Authorization', `Bearer ${idToken}`);

    const res = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${idToken}`)
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
    const { idToken } = await getTestIdToken('prefs-isolated', { displayName: 'Jane Doe' });
    const sessionRes = await request(app)
      .post('/api/auth/session')
      .set('Authorization', `Bearer ${idToken}`);

    const patchRes = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ themePreference: 'light' });

    expect(patchRes.body.displayName).toBe(sessionRes.body.displayName);
    expect(patchRes.body.email).toBe(sessionRes.body.email);
    expect(patchRes.body.uid).toBe(sessionRes.body.uid);
    expect(patchRes.body.createdAt).toBe(sessionRes.body.createdAt);
  });
});

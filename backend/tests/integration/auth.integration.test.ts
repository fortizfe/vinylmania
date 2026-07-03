import { getFirestoreDb } from '../../src/config/firebase-admin';
import { getOrCreateUser } from '../../src/services/userService';
import { clearEmulatorFirestore, clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';

describe('User get-or-create (Firestore emulator)', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('creates a new users/{uid} document on first sign-in', async () => {
    const { uid } = await getTestIdToken('first-timer', { displayName: 'Jane Doe' });

    const user = await getOrCreateUser({
      uid,
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      photoURL: undefined,
    });

    expect(user.uid).toBe(uid);
    expect(user.createdAt).toBeDefined();
    expect(user.lastSignInAt).toBeDefined();

    const snapshot = await getFirestoreDb().collection('users').doc(uid).get();
    expect(snapshot.exists).toBe(true);
  });

  it('reuses the existing document and updates lastSignInAt on a later sign-in', async () => {
    const { uid } = await getTestIdToken('returning-user', { displayName: 'Jane Doe' });

    const first = await getOrCreateUser({
      uid,
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      photoURL: undefined,
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await getOrCreateUser({
      uid,
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      photoURL: undefined,
    });

    expect(second.createdAt).toEqual(first.createdAt);
    expect(new Date(second.lastSignInAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.lastSignInAt).getTime(),
    );

    const snapshot = await getFirestoreDb().collection('users').doc(uid).get();
    expect(snapshot.exists).toBe(true);
  });
});

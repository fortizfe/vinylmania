import { getFirestoreDb } from '../../../../src/config/firebase-admin';
import { firestoreSessionStoreAdapter } from '../../../../src/adapters/auth/firestoreSessionStoreAdapter';
import { clearEmulatorFirestore } from '../../../helpers/authEmulator';

const { createSession, touchSession, revokeSession } = firestoreSessionStoreAdapter;

function sessionDoc(sessionId: string) {
  return getFirestoreDb().collection('sessions').doc(sessionId);
}

describe('firestoreSessionStoreAdapter (Firestore emulator)', () => {
  afterEach(async () => {
    await clearEmulatorFirestore();
  });

  it('createSession persists a session document owned by the given uid', async () => {
    const session = await createSession('uid-1');

    expect(session.uid).toBe('uid-1');
    expect(session.sessionId).toBeTruthy();

    const snapshot = await sessionDoc(session.sessionId).get();
    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()?.uid).toBe('uid-1');
  });

  it('touchSession extends expiresAt (sliding window) for a session nearing expiry and returns the owning uid', async () => {
    const session = await createSession('uid-2');
    const nearExpiry = new Date(Date.now() + 1000); // 1s from now — well inside the renewal threshold
    await sessionDoc(session.sessionId).update({ expiresAt: nearExpiry });

    const touched = await touchSession(session.sessionId);

    expect(touched?.uid).toBe('uid-2');
    expect(touched?.expiresAt).toBeTruthy();
    expect(new Date(touched!.expiresAt).getTime()).toBeGreaterThan(nearExpiry.getTime());
  });

  it('touchSession resolves null for an unknown session id', async () => {
    const touched = await touchSession('does-not-exist');
    expect(touched).toBeNull();
  });

  it('touchSession resolves null for an expired session', async () => {
    const session = await createSession('uid-3');
    await sessionDoc(session.sessionId).update({ expiresAt: new Date(Date.now() - 1000) });

    const touched = await touchSession(session.sessionId);

    expect(touched).toBeNull();
  });

  it('revokeSession deletes only the targeted session, leaving other sessions for the same uid untouched', async () => {
    const deviceA = await createSession('uid-4');
    const deviceB = await createSession('uid-4');

    await revokeSession(deviceA.sessionId);

    expect((await sessionDoc(deviceA.sessionId).get()).exists).toBe(false);
    expect((await sessionDoc(deviceB.sessionId).get()).exists).toBe(true);
  });

  it('revokeSession on an already-gone session is a no-op (idempotent)', async () => {
    await expect(revokeSession('never-existed')).resolves.not.toThrow();
  });
});

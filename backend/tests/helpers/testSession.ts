import { firestoreSessionStoreAdapter } from '../../src/adapters/auth/firestoreSessionStoreAdapter';

export interface TestSession {
  sessionToken: string;
  uid: string;
}

/**
 * Creates a real session document directly in the Firestore emulator and
 * returns its opaque token, for use as `Authorization: Bearer <token>` in
 * authenticated-route tests. Replaces `authEmulator.ts`'s `getTestIdToken`
 * as the credential source for every test suite that isn't specifically
 * exercising the Google login flow or the legacy-token-rejection check
 * (research.md R5) — no Auth Emulator round trip required.
 */
export async function createTestSession(uid: string): Promise<TestSession> {
  const session = await firestoreSessionStoreAdapter.createSession(uid);
  return { sessionToken: session.sessionId, uid: session.uid };
}

const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vinylmania-test';

// Bounds each direct emulator call independently of the surrounding test's
// own timeout (spec 042, FR-004) — a non-responding emulator should fail
// fast and identify which helper call stalled, not hang until the test's
// generic timeout eventually fires. Overridable so tests can exercise the
// abort path quickly instead of waiting for the real default.
const FETCH_TIMEOUT_MS = Number(process.env.EMULATOR_FETCH_TIMEOUT_MS) || 5000;

/**
 * Mints a real Firebase ID token from the Auth emulator for a test user.
 * Uses the emulator's email/password sign-up endpoint purely as a way to
 * obtain a validly-signed Firebase ID token to exercise our own
 * verification logic — the feature itself only ever uses Google sign-in.
 */
export interface TestIdentity {
  idToken: string;
  uid: string;
}

export async function getTestIdToken(
  uidHint: string,
  overrides: { email?: string; displayName?: string } = {},
): Promise<TestIdentity> {
  const email = overrides.email ?? `${uidHint}@example.com`;
  // NOSONAR: fixture value for the local, unauthenticated Auth emulator only
  // (no real account or secret involved) — required by its sign-up API shape.
  const password = 'test-password-123';

  const signUpUrl = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;
  const signUpRes = await fetch(signUpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      // Setting displayName at sign-up time (rather than via a follow-up
      // accounts:update call) ensures the returned idToken's "name" claim
      // is populated — accounts:update does not reliably return a token
      // carrying the new claim.
      displayName: overrides.displayName,
      returnSecureToken: true,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!signUpRes.ok) {
    throw new Error(`Failed to create emulator test user: ${await signUpRes.text()}`);
  }

  const signUpBody = (await signUpRes.json()) as { idToken: string; localId: string };

  return { idToken: signUpBody.idToken, uid: signUpBody.localId };
}

export async function clearEmulatorUsers(): Promise<void> {
  const url = `http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`;
  await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

export async function clearEmulatorFirestore(): Promise<void> {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  const url = `http://${firestoreHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

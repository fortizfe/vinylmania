import { deleteApp, getApps } from 'firebase-admin/app';
import dotenv from 'dotenv';

// Extracted so tests can re-apply these defaults directly (see
// tests/unit/helpers/setupEnv.test.ts) without re-importing this module —
// re-import would re-run the afterAll registration below mid-test-run,
// which Jest forbids once execution has started.
export function applyTestEnvDefaults(): void {
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vinylmania-test';
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

  // Unlike the Firebase variables above (which preserve a real value
  // `firebase emulators:exec` may have already injected), REDIS_URL has no
  // legitimate test-time source — it's always blanked so a real `ioredis`
  // client is never constructed against backend/.env's dev-container URL
  // during tests (spec 042, FR-005).
  process.env.REDIS_URL = '';

  // OAuth 1.0a signing needs *some* consumer key/secret to produce a header;
  // contract tests stub the Discogs endpoints with nock rather than
  // validating the signature against the real API, so a fixed test value is
  // enough. Without this, any environment lacking a real .env (e.g. CI) hits
  // collectionClient's "not configured" guard instead of the scenario the
  // test means to exercise.
  process.env.DISCOGS_CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY || 'test-consumer-key';
  process.env.DISCOGS_CONSUMER_SECRET =
    process.env.DISCOGS_CONSUMER_SECRET || 'test-consumer-secret';

  // Load backend/.env last, so it only fills in variables not already set
  // above (e.g. DISCOGS_TOKEN) without overriding the Firebase emulator
  // fallbacks with a real project, per feature 001's test isolation.
  dotenv.config();
}

applyTestEnvDefaults();

afterAll(async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

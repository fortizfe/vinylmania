import { deleteApp, getApps } from 'firebase-admin/app';
import dotenv from 'dotenv';

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vinylmania-test';
process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

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

afterAll(async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

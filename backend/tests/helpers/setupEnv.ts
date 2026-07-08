import { deleteApp, getApps } from 'firebase-admin/app';
import dotenv from 'dotenv';

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vinylmania-test';
process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

// Load backend/.env last, so it only fills in variables not already set
// above (e.g. DISCOGS_TOKEN) without overriding the Firebase emulator
// fallbacks with a real project, per feature 001's test isolation.
dotenv.config();

afterAll(async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

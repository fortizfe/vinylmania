import { deleteApp, getApps } from 'firebase-admin/app';

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vinylmania-test';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

afterAll(async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

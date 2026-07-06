import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Single source of truth for the fake Firebase project the frontend and
// backend both point at during e2e runs (feature 001's vinylmania-test
// project, already used by the backend's Jest suite).
dotenv.config({ path: path.resolve(__dirname, '../frontend/.env.test') });

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:3001';
const DISCOGS_STUB_URL = 'http://localhost:4571';
const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'vinylmania-test';
const AUTH_EMULATOR_HOST = 'localhost:9099';
const FIRESTORE_EMULATOR_HOST = 'localhost:8080';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // The Firebase emulators themselves are started by the `test` npm script
  // (`firebase emulators:exec` wraps this entire `playwright test` run) —
  // see package.json and research.md §3's rationale for preferring
  // emulators:exec over a plain `emulators:start` webServer entry: exec
  // reliably tears down the Firestore emulator's underlying JVM afterward,
  // where a backgrounded `emulators:start` process observed in practice
  // could leave it running and block the next run's port. Here, Playwright
  // only needs to start the backend and frontend dev servers pointed at
  // whichever emulators are already up by the time this config loads.
  // reuseExistingServer is disabled outside CI so a port already held by an
  // unrelated process fails fast instead of silently testing against it.
  webServer: [
    {
      // Local Discogs OAuth stub (feature 015) — keeps e2e hermetic; the
      // backend below is pointed at it instead of the real Discogs hosts.
      command: 'node helpers/discogsOauthStub.ts',
      cwd: __dirname,
      url: 'http://localhost:4571/health',
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: 'npm run dev',
      cwd: path.resolve(__dirname, '../backend'),
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        PORT: '3001',
        FRONTEND_ORIGIN: FRONTEND_URL,
        FIREBASE_PROJECT_ID,
        FIRESTORE_EMULATOR_HOST,
        FIREBASE_AUTH_EMULATOR_HOST: AUTH_EMULATOR_HOST,
        // Feature 015: Discogs OAuth account linking, targeting the stub
        // above with fake consumer credentials (never the real key/secret).
        DISCOGS_OAUTH_BASE_URL: DISCOGS_STUB_URL,
        DISCOGS_BASE_URL: DISCOGS_STUB_URL,
        DISCOGS_AUTHORIZE_BASE_URL: `${DISCOGS_STUB_URL}/oauth/authorize`,
        DISCOGS_CONSUMER_KEY: 'e2e-fake-consumer-key',
        DISCOGS_CONSUMER_SECRET: 'e2e-fake-consumer-secret',
        DISCOGS_OAUTH_CALLBACK_URL: `${FRONTEND_URL}/app/profile/discogs/callback`,
      },
    },
    {
      command: 'npm run dev',
      cwd: path.resolve(__dirname, '../frontend'),
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        VITE_USE_FIREBASE_EMULATOR: 'true',
        VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY ?? '',
        VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
        VITE_FIREBASE_PROJECT_ID: FIREBASE_PROJECT_ID,
        VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
        VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
        VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID ?? '',
      },
    },
  ],
});

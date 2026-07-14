/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setupEnv.ts'],
  clearMocks: true,
  // Contract/integration tests share one Firebase emulator's mutable state
  // (Auth users, Firestore docs). Running test files in parallel workers lets
  // one file's afterEach cleanup wipe data another file's test is still
  // using, causing flaky cross-file failures — so tests run serially.
  maxWorkers: 1,
  // Explicit ceiling for every test() body and beforeAll/beforeEach/afterEach
  // /afterAll hook (Jest >=29 applies testTimeout to both uniformly) — well
  // above normal emulator-call latency, but bounded instead of the previous
  // implicit 5000ms default that didn't cover hooks (spec 042, FR-001).
  testTimeout: 15_000,
};

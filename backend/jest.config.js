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
};

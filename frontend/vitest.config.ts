import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Node 22+'s experimental global `localStorage` shadows jsdom's own
// window.localStorage unless disabled, leaving it undefined in tests. The
// flag doesn't exist on older Node (e.g. Node 20, used in CI), where `node`
// rejects any unrecognized flag as a hard error — so only pass it when the
// running Node actually supports it, per Node's own allowed-flags registry.
const supportsNoExperimentalWebstorage = process.allowedNodeEnvironmentFlags.has(
  '--no-experimental-webstorage',
);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    ...(supportsNoExperimentalWebstorage
      ? { pool: 'forks' as const, execArgv: ['--no-experimental-webstorage'] }
      : {}),
  },
});

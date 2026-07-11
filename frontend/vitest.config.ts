import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    // Node 22+'s experimental global `localStorage` shadows jsdom's own
    // window.localStorage unless disabled, leaving it undefined in tests.
    pool: 'forks',
    execArgv: ['--no-experimental-webstorage'],
  },
});

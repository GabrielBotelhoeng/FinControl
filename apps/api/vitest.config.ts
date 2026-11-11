import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});

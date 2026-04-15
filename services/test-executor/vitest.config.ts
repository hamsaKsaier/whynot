import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/*.config.ts',
        '**/dist/**',
        '**/node_modules/**',
        '**/*.d.ts',
      ],
    },
  },
});

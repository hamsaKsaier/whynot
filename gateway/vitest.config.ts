import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 39,
        branches: 84,
        functions: 71,
        statements: 39,
      },
      include: ['src/**'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/*.d.ts',
        '**/*.config.ts',
        'src/api/main.ts',
        '../services/qa-loop-executor/src/v2/**',
        '../services/qa-loop-executor/src/mcp-browser.ts',
      ],
    },
  },
});

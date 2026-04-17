import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 97,
        branches: 90,
        functions: 99,
        statements: 97,
      },
      include: [
        'database/**/*.ts',
        'constants/**/*.ts',
        'logger/**/*.ts',
        'types/**/*.ts',
        'utils/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '../services/qa-loop-executor/src/v2/**',
        '../services/qa-loop-executor/src/mcp-browser.ts',
      ],
    },
  },
});

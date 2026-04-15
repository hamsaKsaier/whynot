# Test Coverage Policy

## 100% Coverage Requirement

All four packages (`frontend/`, `admin-frontend/`, `gateway/`, `shared/`) enforce **100% coverage** for lines, branches, functions, and statements.

| Metric     | Threshold |
|------------|-----------|
| Lines      | 100%      |
| Branches   | 100%      |
| Functions  | 100%      |
| Statements | 100%      |

## CI Gate

The `unit-integration` job in `.github/workflows/test.yml` runs `npx vitest run --coverage` per package. If any package drops below 100% on any metric, the job fails and the PR cannot merge.

Coverage HTML reports are uploaded as build artifacts for every CI run (retained 14 days).

## Running Coverage Locally

```bash
# Per-package coverage (Docker-only)
docker compose -f docker-compose.test.yml run --rm gateway-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm frontend-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm admin-frontend-test npx vitest run --coverage
docker compose -f docker-compose.test.yml run --rm shared-test npx vitest run --coverage
```

## Excluded Paths

The following paths are excluded from coverage measurement:

| Path | Reason |
|------|--------|
| `services/qa-loop-executor/src/v2/**` | Untouchable read-only engine |
| `services/qa-loop-executor/src/mcp-browser.ts` | Untouchable MCP integration |
| `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts` | Test files |
| `**/__tests__/**` | Test directories |
| `**/dist/**`, `**/node_modules/**` | Build outputs |
| `**/*.d.ts` | Type declarations |
| `**/*.config.ts` | Configuration files |
| `src/main.tsx` (frontend, admin-frontend) | React entry point (bootstrapping only) |
| `src/server.ts` (gateway) | Express entry point (bootstrapping only) |
| `src/routeTree.gen.ts` (frontend) | Auto-generated route tree |

## `/* istanbul ignore */` Policy

**Forbidden** unless the line is provably unreachable AND annotated with an inline one-line WHY comment explaining why it cannot be reached.

## Configuration

Coverage thresholds are configured in each package's `vitest.config.ts`:

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  thresholds: {
    lines: 100,
    branches: 100,
    functions: 100,
    statements: 100,
  },
  include: ['src/**'],
  exclude: [/* see excluded paths above */],
}
```

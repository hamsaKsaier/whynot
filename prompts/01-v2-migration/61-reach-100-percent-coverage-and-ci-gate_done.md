# Reach 100% coverage everywhere + turn on the CI gate

## Agent
`api-designer` (lead) + `design-ui-designer` + skill `feature-flag-implementation` (for any remaining flag-coverage gaps)

## Depends on
`60-validate-usage-tab-and-danger-zone.md`

## Goal
Close every remaining coverage gap across `frontend/`, `admin-frontend/`, `gateway/`, and `shared/`, set the Vitest threshold to 100% (lines/branches/functions/statements), and enable the CI gate that blocks merges below 100%.

## Single source of truth
`ARCHITECTURE.md` section 15.

## Untouchable paths (reminder + coverage exclusion)
- `services/qa-loop-executor/src/v2/` — exclude from coverage (read-only)
- `services/qa-loop-executor/src/mcp-browser.ts` — exclude
- `services/database/migrations/` — not code, not measured
- generated files (build outputs, codegen artifacts) — exclude

## Task

### 1. Per-package vitest config
- For each package (`frontend/`, `admin-frontend/`, `gateway/`, `shared/`), update `vitest.config.ts`:
  ```ts
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
      include: ['src/**'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/dist/**',
        '**/node_modules/**',
        // global untouchables
        '../services/qa-loop-executor/src/v2/**',
        '../services/qa-loop-executor/src/mcp-browser.ts',
      ],
    },
  },
  ```

### 2. Sweep coverage gaps
- Run `bun vitest run --coverage` per package.
- For every uncovered line/branch, add a focused unit/integration test that exercises it.
- Do NOT add `/* istanbul ignore next */` directives unless the line is provably unreachable AND documented inline with a one-line WHY.

### 3. CI gate
- Update CI workflow (created in prompt 05) to:
  - Run `bun vitest run --coverage` per package.
  - Fail the job if any package's coverage falls below 100%.
  - Upload coverage HTML as a build artifact.
- Block PR merges to `main` until the coverage job is green.

### 4. ARCHITECTURE.md
- Update section 15: state the 100% coverage rule, the exclusions, the CI gate behaviour.

### Files to create/modify
- `frontend/vitest.config.ts`, `admin-frontend/vitest.config.ts`, `gateway/vitest.config.ts`, `shared/vitest.config.ts` — thresholds + excludes
- New unit/integration tests under each package, as needed to close gaps
- `.github/workflows/ci.yml` (or equivalent) — coverage gate
- `ARCHITECTURE.md` — section 15

### Tests
- This prompt **is** the test prompt. The acceptance criterion is that `bun vitest run --coverage` exits 0 in every package with 100% on every metric.

### i18n
- N/A.

### Documentation
- Update `docs/{en,ar,fr,de,es}/testing/coverage.md` with the new rule + exclusions.

### Acceptance criteria
- [ ] Coverage 100% lines/branches/functions/statements in every package.
- [ ] Untouchable paths excluded.
- [ ] CI gate blocks below-100% PRs.
- [ ] `ARCHITECTURE.md` section 15 reflects reality.
- [ ] No `/* istanbul ignore */` directives without an inline WHY.

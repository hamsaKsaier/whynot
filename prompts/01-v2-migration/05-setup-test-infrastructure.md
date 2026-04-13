# Set up the test infrastructure (Vitest + Playwright + Supertest + axe + Lighthouse, Docker-only)

## Agent
`api-designer` (lead, for test-surface design) + `prompt-engineer` (consult)

## Depends on
`01-create-architecture-md.md`, `02-validate-architecture-md.md`, `04-validate-claude-and-opencode-assets.md`

## Goal
Stand up the project's entire test toolchain so every subsequent prompt can write passing tests on day one. No coverage gate yet (that lands in prompt 61). Every test command runs inside Docker; there is no host-node test path.

## Reference
- `ARCHITECTURE.md` section 15.
- The project's existing `docker-compose*.yml` (if any) as a starting point.

## Task

### 1. Install runtime dependencies
Add dev dependencies to the relevant `package.json` files. Use `bun add -d` (project already uses bun); if the project uses npm/pnpm, match the existing manager — DO NOT switch.

**`frontend/` and `admin-frontend/`**:
- `vitest`
- `@vitest/coverage-v8`
- `@vitest/ui` (optional, dev-only)
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `jsdom`
- `@playwright/test`
- `@axe-core/playwright`
- `axe-core`
- `lighthouse` + `lighthouse-ci` (in `frontend/` only — landing page lives there)

**`gateway/`**:
- `vitest`
- `@vitest/coverage-v8`
- `supertest`
- `@types/supertest`
- `nock` (HTTP mocking for Stripe/LLM providers)

**`shared/`**:
- `vitest`
- `@vitest/coverage-v8`

**Each service under `services/*` that is Node/TS** (test-executor, qa-loop-executor, database-migration-runner): add `vitest` + `@vitest/coverage-v8`. **Do NOT** add test setup to `services/ai-service/` unless it already has one — that is Python and out of scope for this migration.

### 2. Create `vitest.config.ts` in each package
Template (adapt per package):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // or 'jsdom' for frontend/admin-frontend
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Thresholds OFF for now — enabled in prompt 61.
      exclude: [
        'services/qa-loop-executor/src/v2/**',
        'services/qa-loop-executor/src/mcp-browser.ts',
        '**/*.config.ts',
        '**/dist/**',
        '**/node_modules/**',
        '**/*.d.ts',
      ],
    },
  },
});
```

For frontend packages, set `environment: 'jsdom'` and add `setupFiles: ['./src/__tests__/setup.tsx']` that imports `@testing-library/jest-dom`.

### 3. Create `playwright.config.ts` in `frontend/` and `admin-frontend/`
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://frontend:5183',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop-ltr-light', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-desktop-ltr-dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'chromium-mobile-ltr-light', use: { ...devices['Pixel 7'] } },
    // RTL + ar locale variants for critical flows — added in phase 4.
  ],
});
```

### 4. Create a `docker-compose.test.yml` at repo root
Services:
- `postgres-test` — `postgres:16-alpine`, ephemeral volume, pre-seeded with migrations via an init script.
- `gateway-test` — built from `gateway/Dockerfile.test` (or the existing Dockerfile with `NODE_ENV=test`), depends on `postgres-test`, command `bun vitest run --coverage`.
- `frontend-test` — built from `frontend/Dockerfile.test`, command `bun vitest run --coverage`.
- `admin-frontend-test` — same pattern.
- `playwright` — official `mcr.microsoft.com/playwright:v1.48.0-jammy` image, mounts the repo, runs `bunx playwright test`.
- `lighthouse` — runs `lighthouse-ci` against a preview-built frontend.

Required env vars (read from `.env.test` — create as a template with safe defaults):
- `DATABASE_URL`
- `JWT_SECRET=test-secret`
- `STRIPE_SECRET_KEY=sk_test_stub`
- `STRIPE_WEBHOOK_SECRET=whsec_stub`
- `ANTHROPIC_API_KEY=test-stub`
- `OPENAI_API_KEY=test-stub`
- `AI_CONFIG_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef` (AES-256 test key)

### 5. Create a minimal CI workflow skeleton
`.github/workflows/test.yml` (or the equivalent CI platform the repo already uses — inspect first):
- Trigger: `push` and `pull_request`.
- Jobs:
  1. **lint-typecheck** — `docker compose -f docker-compose.test.yml run --rm gateway-test bun typecheck` and the equivalent in frontend/admin.
  2. **unit-integration** — `docker compose -f docker-compose.test.yml run --rm gateway-test bun vitest run`, plus frontend + admin vitest.
  3. **e2e** — `docker compose -f docker-compose.test.yml up -d postgres-test && docker compose -f docker-compose.test.yml run --rm playwright bunx playwright test`.
  4. **a11y** — part of e2e; runs axe via `@axe-core/playwright`.
  5. **lighthouse** — only on `frontend/`, gated to `main` branch at first (don't block PRs until landing page exists — phase 9).
- **Coverage gate**: NOT enabled yet. Prompt 61 turns it on.

### 6. Add "hello world" tests proving each runner works
- `gateway/src/__tests__/smoke.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import request from 'supertest';
  import { app } from '../app'; // or wherever Express is exported
  describe('smoke', () => {
    it('GET /api/healthz returns 200', async () => {
      const res = await request(app).get('/api/healthz');
      expect(res.status).toBe(200);
    });
  });
  ```
  If `/api/healthz` does not exist, add it as a 1-line Express handler returning `{ status: 'ok' }`.

- `frontend/src/__tests__/smoke.test.tsx`:
  ```tsx
  import { render, screen } from '@testing-library/react';
  import { describe, it, expect } from 'vitest';
  describe('smoke', () => {
    it('renders without crashing', () => {
      render(<div>hello</div>);
      expect(screen.getByText('hello')).toBeInTheDocument();
    });
  });
  ```

- `admin-frontend/src/__tests__/smoke.test.tsx` — same pattern.

- `shared/__tests__/smoke.test.ts` — trivial `expect(1 + 1).toBe(2)`.

- `frontend/e2e/smoke.spec.ts`:
  ```ts
  import { test, expect } from '@playwright/test';
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/whynot/i);
  });
  ```
  Note: at this phase the landing page may not yet be rebuilt (phase 9). Accept the smoke test failing until phase 9 OR mark it `test.skip()` with a TODO pointing to prompt 49.

### 7. Update `ARCHITECTURE.md` section 15
Replace the placeholder commands with the real ones, for example:
```
- Frontend unit: docker compose -f docker-compose.test.yml run --rm frontend-test bun vitest run
- Gateway unit + supertest: docker compose -f docker-compose.test.yml run --rm gateway-test bun vitest run
- E2E: docker compose -f docker-compose.test.yml run --rm playwright bunx playwright test
- Coverage: add --coverage to any vitest command
```

### Files to create/modify
- `frontend/package.json`, `admin-frontend/package.json`, `gateway/package.json`, `shared/package.json`, `services/*/package.json` — dev deps.
- `frontend/vitest.config.ts`, `admin-frontend/vitest.config.ts`, `gateway/vitest.config.ts`, `shared/vitest.config.ts` — new.
- `frontend/playwright.config.ts`, `admin-frontend/playwright.config.ts` — new.
- `docker-compose.test.yml` — new at repo root.
- `.env.test` — new template at repo root.
- `gateway/Dockerfile.test` or reuse existing — as appropriate.
- `.github/workflows/test.yml` — new (or the existing CI platform's equivalent).
- `gateway/src/__tests__/setup.ts`, `gateway/src/__tests__/smoke.test.ts`.
- `frontend/src/__tests__/setup.tsx`, `frontend/src/__tests__/smoke.test.tsx`.
- `admin-frontend/src/__tests__/setup.tsx`, `admin-frontend/src/__tests__/smoke.test.tsx`.
- `shared/__tests__/smoke.test.ts`.
- `frontend/e2e/smoke.spec.ts` (may be `test.skip()`-ed until phase 9).
- `ARCHITECTURE.md` — section 15 updated.

### Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/` — excluded from coverage via the `exclude` list.
- `services/qa-loop-executor/src/mcp-browser.ts` — excluded.
- `services/database/migrations/` — do not add test files here.

### Tests
The smoke tests written in step 6 are themselves the first tests. They must pass in Docker.

### i18n
N/A — test infra is not user-facing.

### Documentation
- Update `ARCHITECTURE.md` section 15 with actual commands.
- Create `/docs/testing.md` (English only for now; 5-language version lands in prompt 61). Short: how to run tests locally (via Docker), how to read coverage, how to write a new test.

### Acceptance criteria
- [ ] All dev deps installed; `package.json` changes committed.
- [ ] All config files present and valid.
- [ ] `docker compose -f docker-compose.test.yml config` parses successfully.
- [ ] `docker compose -f docker-compose.test.yml run --rm gateway-test bun vitest run` exits 0.
- [ ] `docker compose -f docker-compose.test.yml run --rm frontend-test bun vitest run` exits 0.
- [ ] `docker compose -f docker-compose.test.yml run --rm admin-frontend-test bun vitest run` exits 0.
- [ ] Playwright install succeeds and `playwright test smoke.spec.ts` runs (even if skipped).
- [ ] `ARCHITECTURE.md` section 15 updated.
- [ ] No changes to any untouchable path.

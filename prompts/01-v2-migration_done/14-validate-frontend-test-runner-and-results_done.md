# Validate: Frontend test runner + results rewrite

## Agent
`design-ui-designer` (verifier) + `api-designer` (contract sanity for streaming)

## Depends on
`13-rewrite-frontend-test-runner-and-results.md`

## Goal
Verify the rewritten runner and results UI behaves identically to the legacy version against a seeded execution, passes visual/a11y/perf bars, and keeps 100% coverage on touched files.

## Validation steps

### 1. Typecheck + lint + stylelint
```bash
cd /home/serverlessbase/whynot
docker compose -f docker-compose.test.yml run --rm frontend-test bun typecheck
docker compose -f docker-compose.test.yml run --rm frontend-test bun lint
docker compose -f docker-compose.test.yml run --rm frontend-test bunx stylelint 'frontend/src/**/*.{css,tsx}'
```

### 2. External API stability check
For every public export from the old BrowserPreview/QALoop/TestResults, assert the same symbol exists with a compatible type signature. Run:
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test \
  bun vitest run src/components/BrowserPreview/__tests__/api.test.ts \
  src/components/QALoop/__tests__/api.test.ts \
  src/components/TestResults/__tests__/api.test.ts
```
These tests instantiate each component with the same props shape and assert default-export + named-export presence.

### 3. Vitest integration: streaming playback
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test \
  bun vitest run src/pages/TestRunnerPage.test.tsx
```
The test:
- Mocks the websocket/event source.
- Feeds a recorded sequence of events (agent start, browser navigate, DOM diff, assertion pass, assertion fail, final summary).
- Asserts every event is reflected in the UI (counters incremented, agent board updated, results table populated).

### 4. Coverage = 100% for touched files
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test \
  bun vitest run --coverage \
  src/components/BrowserPreview src/components/QALoop src/components/TestResults \
  src/pages/TestRunnerPage.tsx src/pages/ExecutionDetailPage.tsx \
  src/components/KeyboardShortcutsDialog.tsx
```

### 5. Playwright e2e
```bash
docker compose -f docker-compose.test.yml up -d postgres-test gateway-test frontend-test
docker compose -f docker-compose.test.yml run --rm playwright \
  bunx playwright test frontend/e2e/runner.spec.ts \
  --project chromium-desktop-ltr-light \
  --project chromium-desktop-ltr-dark \
  --project chromium-mobile-ltr-light
```
Assert:
- A seeded execution starts and completes.
- Pause/resume/stop controls work.
- Keyboard shortcuts (`space`, `r`, `esc`, `?`) work.
- Trace viewer tabs render.
- Dark + mobile layouts correct.

### 6. Axe a11y
```ts
await injectAxe(page);
await checkA11y(page, 'main');
```
Zero serious/critical. Verify `aria-live="polite"` region exists.

### 7. Performance gate
Measure `performance.now()` from navigation.start to first agent event visible. Must be < 500ms with simulated 100ms network latency.

### 8. No physical-direction Tailwind
```bash
for f in $(git diff --name-only HEAD~1..HEAD -- 'frontend/src/**/*.tsx'); do
  grep -E '(\sml-|\smr-|\spl-|\spr-|\sleft-|\sright-)' "$f" && exit 1
done
```

### 9. i18n keys
```bash
for k in runner.title runner.controls.pause runner.agent.status.running \
         results.summary.pass results.table.columns.name results.artifact.screenshot ; do
  jq -e ".${k}" frontend/public/locales/en/common.json > /dev/null || exit 1
done
```

### 10. Untouchable + backend unchanged
```bash
git diff --name-only HEAD~1..HEAD | grep -E '^services/qa-loop-executor/src/v2/|mcp-browser\.ts|^services/database/migrations/|^gateway/' && exit 1 || true
```

### 11. Regression suite
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test bun vitest run || exit 1
docker compose -f docker-compose.test.yml run --rm playwright \
  bunx playwright test frontend/e2e/auth.spec.ts frontend/e2e/dashboard.spec.ts || exit 1
```

## Pass criteria
- [ ] Typecheck/lint/stylelint clean.
- [ ] External component API preserved.
- [ ] Vitest integration streaming playback green.
- [ ] Coverage for touched files = 100%.
- [ ] Playwright runner e2e green in 3 projects.
- [ ] Axe serious/critical = 0; live region present.
- [ ] Performance: first event < 500ms.
- [ ] No physical-direction Tailwind classes in modified files.
- [ ] i18n keys present.
- [ ] No untouchable/backend regressions.
- [ ] Prior phases still green.

## On failure
- Streaming regression: compare mocked event sequence to legacy snapshot; find the missing handler.
- Coverage miss: usually an uncovered error branch in stream reconnection.
- Perf miss: check for synchronous JSON.parse of large artifacts — defer with `React.lazy`.
- Re-run until green. Do NOT advance to prompt 15 until pass.

# Validate: Frontend dashboard rewrite

## Agent
`design-ui-designer` (verifier)

## Depends on
`11-rewrite-frontend-dashboard-and-overview.md`

## Goal
Verify the rewritten dashboard renders all states, matches the design system, passes a11y and e2e checks with 100% coverage for touched files.

## Validation steps

### 1. File presence
```bash
cd /home/serverlessbase/whynot
for f in \
  frontend/src/pages/DashboardPage.tsx \
  frontend/src/components/dashboard/KpiCard.tsx \
  frontend/src/components/dashboard/Sparkline.tsx \
  frontend/src/components/dashboard/ActivityFeed.tsx \
  frontend/src/components/dashboard/RecentRunsTable.tsx \
  frontend/src/components/dashboard/ErrorsPanel.tsx \
  frontend/src/components/dashboard/UsageCharts.tsx \
  frontend/src/components/dashboard/DashboardHero.tsx ; do
  test -f $f || { echo "missing $f"; exit 1; }
done
```

### 2. Typecheck, lint, stylelint
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test bun typecheck
docker compose -f docker-compose.test.yml run --rm frontend-test bun lint
docker compose -f docker-compose.test.yml run --rm frontend-test bunx stylelint 'frontend/src/**/*.{css,tsx}'
```
All exit 0.

### 3. Vitest coverage = 100% for touched files
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test \
  bun vitest run --coverage \
  src/pages/DashboardPage.tsx src/components/dashboard || exit 1
```

### 4. Playwright e2e dashboard
```bash
docker compose -f docker-compose.test.yml up -d postgres-test gateway-test frontend-test
docker compose -f docker-compose.test.yml run --rm playwright \
  bunx playwright test frontend/e2e/dashboard.spec.ts \
  --project chromium-desktop-ltr-light \
  --project chromium-desktop-ltr-dark \
  --project chromium-mobile-ltr-light || exit 1
```
Assert:
- KPI cards visible and contain numbers (or the empty-state card if data is empty).
- Each tab clickable; content changes.
- Empty state renders for seeded "no data" test user.
- No console errors.

### 5. Axe a11y
```ts
await injectAxe(page);
await checkA11y(page, 'main', { rules: { 'color-contrast': { enabled: true } } });
```
Zero serious/critical violations.

### 6. Dark mode visual diff
Capture light and dark screenshots of the dashboard in a "seeded" state. Verify layout identical (pixel diff outside masked areas < 1%) but backgrounds/text reflect dark palette.

### 7. RTL readiness spot-check
```bash
for f in $(git diff --name-only HEAD~1..HEAD -- 'frontend/src/**/*.tsx'); do
  grep -E '(\sml-|\smr-|\spl-|\spr-|\sleft-|\sright-)' "$f" && { echo "phys dir in $f"; exit 1; }
done
```

### 8. i18n keys present
```bash
for k in dashboard.kpi.activeProjects.label dashboard.tabs.activity dashboard.empty.activity.title ; do
  jq -e ".${k}" frontend/public/locales/en/common.json > /dev/null || { echo "missing key $k"; exit 1; }
done
```

### 9. Untouchable / backend unchanged
```bash
git diff --name-only HEAD~1..HEAD | grep -E '^services/qa-loop-executor/src/v2/|mcp-browser\.ts|^services/database/migrations/|^gateway/' && exit 1 || true
```

### 10. Regression
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test bun vitest run || exit 1
docker compose -f docker-compose.test.yml run --rm playwright bunx playwright test frontend/e2e/auth.spec.ts || exit 1
```

## Pass criteria
- [ ] All files exist; all primitives used.
- [ ] Typecheck + lint + stylelint exit 0.
- [ ] Coverage for touched files = 100%.
- [ ] Playwright dashboard spec passes in 3 projects.
- [ ] Axe serious/critical = 0.
- [ ] Dark mode visual diff within tolerance.
- [ ] No physical-direction Tailwind classes in modified files.
- [ ] Required i18n keys present.
- [ ] No untouchable / backend changes.
- [ ] Auth e2e still green (no regression).

## On failure
- Missing test coverage for a branch → add the missing test, usually an error state.
- Chart component using hex colors → switch to Shadcn tokens via CSS variables.
- Re-run until green. Do NOT advance to prompt 13 until pass.

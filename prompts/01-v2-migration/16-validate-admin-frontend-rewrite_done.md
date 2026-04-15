# Validate: `admin-frontend/` rewrite

## Agent
`design-ui-designer` (verifier) + `api-designer` (data contract sanity)

## Depends on
`15-rewrite-admin-frontend-all-pages.md`

## Goal
Verify every admin page is rewritten in Shadcn, shared components exist, money/dates/pagination honor the contract, and all tests pass with 100% coverage on touched files.

## Validation steps

### 1. File presence
```bash
cd /home/serverlessbase/whynot
for f in \
  admin-frontend/src/App.tsx \
  admin-frontend/src/components/layout/AdminShell.tsx \
  admin-frontend/src/components/admin/AdminPageHeader.tsx \
  admin-frontend/src/components/admin/FilterBar.tsx \
  admin-frontend/src/components/admin/PaginatedTable.tsx \
  admin-frontend/src/components/admin/BulkActions.tsx \
  admin-frontend/src/components/admin/StatusBadge.tsx \
  admin-frontend/src/components/admin/DateRangePicker.tsx \
  admin-frontend/src/components/admin/ConfirmDialog.tsx \
  admin-frontend/src/components/admin/ExportMenu.tsx \
  admin-frontend/src/lib/money.ts ; do
  test -f $f || { echo "missing $f"; exit 1; }
done
for p in DashboardPage UsersPage UserDetailPage PlansPage SubscriptionsPage \
         AnalyticsPage AuditLogPage SystemSettingsPage AnnouncementsPage CreditsPage ; do
  test -f admin-frontend/src/pages/${p}.tsx || { echo "missing $p"; exit 1; }
done
```

### 2. Typecheck + lint + stylelint
```bash
docker compose -f docker-compose.test.yml run --rm admin-frontend-test bun typecheck
docker compose -f docker-compose.test.yml run --rm admin-frontend-test bun lint
docker compose -f docker-compose.test.yml run --rm admin-frontend-test bunx stylelint 'admin-frontend/src/**/*.{css,tsx}'
```

### 3. Vitest coverage = 100% for touched files
```bash
docker compose -f docker-compose.test.yml run --rm admin-frontend-test \
  bun vitest run --coverage \
  src/components/admin src/components/layout src/pages src/lib/money.ts
```

### 4. Playwright admin-flows e2e
```bash
docker compose -f docker-compose.test.yml up -d postgres-test gateway-test admin-frontend-test
docker compose -f docker-compose.test.yml run --rm playwright \
  bunx playwright test admin-frontend/e2e/admin-flows.spec.ts \
  --project chromium-desktop-ltr-light \
  --project chromium-desktop-ltr-dark \
  --project chromium-mobile-ltr-light
```

### 5. Axe a11y on each page
For each route visited in the spec, run `checkA11y(page, 'main')`. Zero serious/critical.

### 6. Contract enforcement

#### Money: no float arithmetic in the rewrite
```bash
# Any `* 100` or `/ 100` not accompanied by `Math.trunc` or `BigInt` suggests a float bug.
grep -rn -E '\*\s*100\b|\/\s*100\b' admin-frontend/src/pages admin-frontend/src/lib/money.ts \
  | grep -v 'BigInt\|Math\.trunc' || true
# This grep must have zero matches.
```

#### Dates: every rendered timestamp goes through Intl.DateTimeFormat
```bash
# No `toLocaleString` without a locale arg (we want explicit locale).
grep -rn 'toLocaleString()' admin-frontend/src/pages admin-frontend/src/components && exit 1 || true
```

#### Pagination: no offset-style in table code
```bash
grep -rn -E '(\bpage=|\boffset=)' admin-frontend/src/pages admin-frontend/src/components/admin \
  | grep -v 'cursor\|nextCursor' && exit 1 || true
```

### 7. No physical-direction Tailwind classes
```bash
for f in $(git diff --name-only HEAD~1..HEAD -- 'admin-frontend/src/**/*.tsx'); do
  grep -E '(\sml-|\smr-|\spl-|\spr-|\sleft-|\sright-)' "$f" && exit 1
done
```

### 8. i18n keys populated
```bash
for k in admin.users.title admin.users.columns.email \
         admin.plans.title admin.subscriptions.title \
         admin.analytics.title admin.audit.title \
         admin.announcements.title admin.credits.title \
         admin.systemSettings.title ; do
  jq -e ".${k}" admin-frontend/public/locales/en/common.json > /dev/null || { echo "missing $k"; exit 1; }
done
```

### 9. `ARCHITECTURE.md` section 8 updated
```bash
grep -q 'Admin architecture' ARCHITECTURE.md || exit 1
# Table with 10 rows for the 10 pages.
grep -A 60 '^## .*Admin architecture' ARCHITECTURE.md | grep -c '| .*Page' | awk '{ if ($1 < 10) exit 1 }'
```

### 10. Untouchable / backend / other-frontend unchanged
```bash
git diff --name-only HEAD~1..HEAD \
  | grep -E '^services/qa-loop-executor/src/v2/|mcp-browser\.ts|^services/database/migrations/|^gateway/|^frontend/' \
  && exit 1 || true
```

### 11. Prior phases regression
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test bun vitest run || exit 1
docker compose -f docker-compose.test.yml run --rm playwright \
  bunx playwright test frontend/e2e/auth.spec.ts frontend/e2e/dashboard.spec.ts frontend/e2e/runner.spec.ts
```

## Pass criteria
- [ ] All shared admin components + 10 pages present.
- [ ] Typecheck/lint/stylelint clean.
- [ ] Coverage for touched files = 100%.
- [ ] Playwright admin-flows green in 3 projects.
- [ ] Axe serious/critical = 0 on every page.
- [ ] Money handled in bigint cents throughout.
- [ ] Dates formatted via `Intl.DateTimeFormat(locale, …)`.
- [ ] No offset pagination in modified files.
- [ ] No physical-direction Tailwind classes.
- [ ] i18n keys present.
- [ ] `ARCHITECTURE.md` section 8 complete.
- [ ] No untouchable/backend/frontend cross-pollution.
- [ ] Prior phases still green.

## On failure
- Float money bug: rewrite with BigInt; add a failing test first.
- Offset pagination regression: mark TODO and convert UI to cursor-compatible placeholder.
- Re-run until green. Do NOT advance to prompt 17 until pass.

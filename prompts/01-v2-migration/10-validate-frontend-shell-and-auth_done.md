# Validate: Frontend shell + auth rewrite

## Agent
`design-ui-designer` (verifier) with `api-designer` for auth contract sanity.

## Depends on
`09-rewrite-frontend-shell-and-auth.md`

## Goal
Verify the rewritten shell + auth pages render, pass validation, hit the real gateway, look correct in light/dark/desktop/mobile, and carry 100% test coverage for touched files.

## Validation steps

### 1. Structural files exist and legacy is gone
```bash
cd /home/serverlessbase/whynot
for f in \
  frontend/src/App.tsx \
  frontend/src/components/layout/AppShell.tsx \
  frontend/src/components/layout/Header.tsx \
  frontend/src/components/layout/Sidebar.tsx \
  frontend/src/components/layout/Footer.tsx \
  frontend/src/components/layout/AuthShell.tsx \
  frontend/src/components/ErrorBoundary.tsx \
  frontend/src/pages/LoginPage.tsx \
  frontend/src/pages/SignupPage.tsx \
  frontend/src/pages/ForgotPasswordPage.tsx \
  frontend/src/pages/ResetPasswordPage.tsx ; do
  test -f $f || { echo "missing $f"; exit 1; }
done
```

### 2. No legacy layout component is still imported
```bash
# Inspect legacy file names noted in the PR description of prompt 09.
# For each legacy file, grep that its basename is not imported anywhere except its own file.
for legacy in "OldHeader" "OldSidebar" "OldLayout" "CustomAuthForm" ; do
  hits=$(grep -rn "$legacy" frontend/src --include='*.tsx' --include='*.ts' | wc -l)
  [ "$hits" -eq 0 ] || { echo "legacy $legacy still referenced"; exit 1; }
done
```
(Replace the example names with the actual legacy symbols the executor identified during prompt 09.)

### 3. Typecheck + lint + stylelint
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test bun typecheck || exit 1
docker compose -f docker-compose.test.yml run --rm frontend-test bun lint || exit 1
docker compose -f docker-compose.test.yml run --rm frontend-test bunx stylelint 'frontend/src/**/*.{css,tsx}' || exit 1
```

### 4. Vitest with coverage ≥100% for touched files
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test \
  bun vitest run --coverage \
  src/components/layout src/components/ErrorBoundary.tsx \
  src/pages/LoginPage.tsx src/pages/SignupPage.tsx \
  src/pages/ForgotPasswordPage.tsx src/pages/ResetPasswordPage.tsx \
  src/pages/VerifyEmailPage.tsx || exit 1
# Parse lcov for touched files; each must show 100%.
```

### 5. Playwright auth e2e in 4 projects
```bash
docker compose -f docker-compose.test.yml up -d postgres-test gateway-test frontend-test
docker compose -f docker-compose.test.yml run --rm playwright bunx playwright test frontend/e2e/auth.spec.ts \
  --project chromium-desktop-ltr-light \
  --project chromium-desktop-ltr-dark \
  --project chromium-mobile-ltr-light \
  --project chromium-mobile-ltr-dark || exit 1
```

### 6. Axe a11y scan on auth pages
```ts
// In the spec, on each auth page:
import { injectAxe, checkA11y } from '@axe-core/playwright';
await injectAxe(page);
await checkA11y(page, null, { detailedReport: true, detailedReportOptions: { html: true } });
```
Zero serious/critical violations.

### 7. RTL readiness spot-check
```bash
# No ml-/mr-/pl-/pr-/left-/right-/text-left/text-right in modified files.
for f in $(git diff --name-only HEAD~1..HEAD -- 'frontend/src/**/*.tsx'); do
  if grep -E '(\sml-|\smr-|\spl-|\spr-|\sleft-|\sright-|\btext-left\b|\btext-right\b)' "$f"; then
    echo "logical-property violation: $f"; exit 1
  fi
done
```

### 8. Dark mode correctness
Playwright screenshot diff: the same page in light and dark must use different background tokens but identical layout (pixel diff outside a masked area < 1%).

### 9. i18n keys scaffolded
```bash
jq '.auth.login.title, .auth.login.emailLabel, .auth.login.passwordLabel, .auth.login.submit' \
  frontend/public/locales/en/common.json > /dev/null || exit 1
```

### 10. Untouchable-paths regression
```bash
git diff --name-only HEAD~5..HEAD \
  | grep -E '^services/qa-loop-executor/src/v2/|^services/qa-loop-executor/src/mcp-browser\.ts|^services/database/migrations/' \
  && { echo "untouchable modified"; exit 1; } || true
```
And the backend wasn't touched:
```bash
git diff --name-only HEAD~1..HEAD | grep -E '^gateway/' && { echo "gateway modified"; exit 1; } || true
```
(Allow the exception only if a previously-missing `/api/healthz` route was added, noted in prompt 05.)

### 11. Regression: prior phases still green
```bash
docker compose -f docker-compose.test.yml run --rm gateway-test bun vitest run || exit 1
docker compose -f docker-compose.test.yml run --rm admin-frontend-test bun vitest run || exit 1
```

## Pass criteria
- [ ] All files present; legacy symbols not referenced.
- [ ] Typecheck + lint + stylelint pass.
- [ ] Vitest coverage on touched files = 100%.
- [ ] Playwright auth e2e passes in 4 viewport/theme combinations.
- [ ] Axe: zero serious/critical violations.
- [ ] No physical-direction Tailwind classes in modified files.
- [ ] Light vs dark screenshot diff outside masked area < 1%.
- [ ] i18n `auth.*` keys present in English locale file.
- [ ] No untouchable/backend regressions.
- [ ] All prior phases' tests still green.

## On failure
- Coverage miss: add targeted unit tests until 100%.
- A11y miss: fix labels, aria-* attributes, color-contrast.
- Physical-direction regression: sed replace and re-check.
- Re-run until green. Do NOT advance to prompt 11 until pass.

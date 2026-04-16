# Validate: Feature flags frontend hook + admin UI

## Agent
`design-ui-designer` (verifier) + `api-designer`

## Depends on
`25-feature-flags-frontend-hook-and-admin-ui.md`

## Goal
Verify the React provider/hook resolves flags correctly and the admin UI manages overrides end-to-end.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Vitest provider/hook tests → pass; coverage 100% on touched files.

### 2. Component tests
- `<Feature flag="X">` renders children only when enabled; renders fallback otherwise.
- Provider handles fetch failures gracefully (returns empty map; UI defaults to "feature off").

### 3. Playwright e2e
- Sign in as superadmin. Open FeatureFlagsPage. Toggle `LANGUAGE_SWITCHER` off for the test org.
- In a separate context, sign in as a user of that org. Reload the dashboard. Assert language switcher is hidden.
- Toggle the flag back on. Reload. Switcher visible.
- Audit trail in the admin page shows two rows for the change.

### 4. i18n smoke
- Switch admin UI to fr, ar, de, es. Assert FeatureFlagsPage table headers and dialog labels are localized in each.

### 5. Regression scan
- Earlier-phase suites still green.
- Coverage unchanged or up.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] Toggling a flag in admin reflects user-side without a redeploy.
- [ ] Audit trail visible.
- [ ] Localized in 5 languages.
- [ ] No regressions.

## On failure
- Re-open `25-feature-flags-frontend-hook-and-admin-ui.md`; fix; rerun.
- Do NOT advance to phase 6 until this validation passes.

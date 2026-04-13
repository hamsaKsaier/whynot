# Validate: Superadmin Audit Log, Analytics, Announcements, Usage

## Agent
`design-ui-designer` (verifier) + `api-designer`

## Depends on
`47-superadmin-audit-analytics-announcements-usage.md`

## Goal
Verify the four pages function, filters work, announcements reach users, and the usage page handles empty/seeded data correctly.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Component tests pass.

### 2. Supertest
- Audit log filters return correct subsets; cursor pagination ordered + non-overlapping.
- Analytics endpoint matches a seeded fixture's expected metrics.
- Announcements CRUD; publish triggers user-side visibility.
- Usage endpoint returns empty array for empty fixture; returns expected rows after seeding `usage_events`.

### 3. Playwright
- Filter audit log by date → fewer rows.
- Publish an announcement → log in as a user → see localized banner.
- Charts dark mode contrast OK (axe).

### 4. i18n
- Each page in fr + ar; layouts intact.

### 5. Coverage + regression
- 100% on touched files; no regressions.

## Pass criteria
- [ ] All commands exit 0.
- [ ] Filters + pagination correct.
- [ ] Announcements visible to user side.
- [ ] Charts accessible in dark + RTL.
- [ ] No regressions.

## On failure
- Re-open `47-superadmin-audit-analytics-announcements-usage.md`; fix; rerun.
- Do NOT advance to phase 9 until this validation passes.

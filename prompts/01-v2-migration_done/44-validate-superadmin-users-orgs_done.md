# Validate: Superadmin Users + Organizations pages

## Agent
`design-ui-designer` (verifier) + `api-designer`

## Depends on
`43-superadmin-users-and-orgs-pages.md`

## Goal
Verify the management capabilities, audit logging, impersonation safety, and localized UI.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Unit tests pass; coverage 100% on touched files.

### 2. Supertest
- Pagination, search, detail endpoints work; camelCase responses.
- Impersonation: token expires within configured TTL; audit row exists.
- Mutations create audit rows with before/after.
- Cross-org / non-superadmin access denied.

### 3. Playwright e2e
- Users list → search → open detail → reset password → email queued.
- Impersonate user → user-side app shows impersonation banner → ending impersonation returns to admin.
- Move user to another org → re-fetch shows new org.
- Force-set plan → BillingTab on user-side reflects the change.

### 4. i18n
- Pages in fr + ar + de + es; layouts intact, no missing keys.

### 5. Coverage + regression
- 100% on touched files; earlier suites green.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] Impersonation safe + visible.
- [ ] Audit log captures every mutation.
- [ ] Localized correctly.
- [ ] No regressions.

## On failure
- Re-open `43-superadmin-users-and-orgs-pages.md`; fix; rerun.
- Do NOT advance to prompt 45 until this validation passes.

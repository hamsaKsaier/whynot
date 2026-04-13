# Validate: Superadmin role, middleware, shell

## Agent
`api-designer` (verifier) + `design-ui-designer`

## Depends on
`41-superadmin-role-middleware-shell.md`

## Goal
Verify the role model, middleware blocking, shell rendering, and access control end-to-end.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Middleware unit tests pass.

### 2. Supertest
- Every admin endpoint:
  - non-authed → 401
  - authed non-superadmin → 403, body localized in fr + ar
  - authed superadmin → 2xx

### 3. Component + Playwright
- AdminShell renders for superadmin; nav grouping correct.
- Non-superadmin redirected from admin routes.
- Login flow as superadmin → dashboard; login as normal user against admin → access denied.
- Visual check: shell in en, fr, ar (RTL), de, es; light + dark.

### 4. Audit log
- Each superadmin login produces an audit row.

### 5. Coverage + regression
- 100% on touched files; no regressions.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] Middleware enforces correctly.
- [ ] Shell renders in all 5 languages × themes × directions.
- [ ] Audit log captures logins.
- [ ] No regressions.

## On failure
- Re-open `41-superadmin-role-middleware-shell.md`; fix; rerun.
- Do NOT advance to prompt 43 until this validation passes.

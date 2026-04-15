# Validate: User Settings tabs

## Agent
`design-ui-designer` (verifier) + `api-designer`

## Depends on
`55-user-settings-profile-org-apikeys-language-notifications-dangerzone-tabs.md`

## Goal
Verify every settings tab works, security invariants hold, and the experience is localized.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Component + hashing tests pass.

### 2. Security invariants
- Create an API key. Inspect logs, audit rows, all GET responses → plaintext key never appears.
- Cross-org read of organization members → 403.
- Cross-user PATCH of profile → 403.

### 3. Playwright
- Each tab reachable via `/settings/<tab>` deep link.
- Profile change → reload → persisted.
- API key create → dialog shows the full key once → reload → only masked form visible.
- Language change → UI immediately reflects + survives reload.
- Notifications toggle → DB row updated.
- Danger Zone delete: re-auth gate, soft-delete with grace period, account flagged `pending_deletion`.

### 4. i18n + RTL
- Each tab in fr + ar; layouts intact, dark mode clean.

### 5. Coverage + regression
- 100% on touched files; no regressions.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] Security invariants hold.
- [ ] Each tab functional, persistent, localized.
- [ ] No regressions.

## On failure
- Re-open `55-user-settings-profile-org-apikeys-language-notifications-dangerzone-tabs.md`; fix; rerun.
- Do NOT advance to prompt 57 until this validation passes.

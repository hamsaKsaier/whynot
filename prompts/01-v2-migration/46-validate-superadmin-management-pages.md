# Validate: Superadmin Plans, BillingConfig, FeatureFlags, AIProviders

## Agent
`api-designer` (verifier) + `design-ui-designer`

## Depends on
`45-superadmin-plans-billing-config-flags-ai.md`

## Goal
Verify each management page mutates platform state correctly and the consequences propagate to user-side behaviour.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Component tests + form validation tests pass.

### 2. Supertest scenarios
- Plans PATCH → updated plan visible in `/api/me/billing/subscription` and `/api/me/billing/checkout` flows.
- BillingConfig PATCH `trial_days=7` → new signup trial ends in 7 days.
- BillingConfig PATCH `payg_rates.ai_call_cents=10` → new usage event ledger charge = 10 cents per call.
- AIProviders PATCH disable=anthropic → `/api/me/ai-providers` does not list Anthropic.
- Non-superadmin → 403 on each.

### 3. Playwright e2e
- Each scenario above driven through the admin UI; assertion happens in the user-side app.
- 5-language smoke pass on each admin page.

### 4. Audit
- Every PATCH writes an audit row with before/after.

### 5. Coverage + regression
- 100% on touched files; no regressions.

## Pass criteria
- [ ] All commands exit 0.
- [ ] Every consequence propagates to user side.
- [ ] Audit log captures every change.
- [ ] No regressions.

## On failure
- Re-open `45-superadmin-plans-billing-config-flags-ai.md`; fix; rerun.
- Do NOT advance to prompt 47 until this validation passes.

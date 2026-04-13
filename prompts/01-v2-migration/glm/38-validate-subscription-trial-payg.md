# Validate: Subscription manager + trial + PAYG

## Agent
`api-designer` (verifier)

## Depends on
`37-subscription-manager-trial-and-payg.md`

## Goal
Verify the 8 subscription/PAYG scenarios pass, money stays bigint, and org isolation holds.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Unit tests pass.

### 2. Lifecycle scenarios
- Run all 8 Supertest scenarios from prompt 37; each must pass.

### 3. Money invariants
- Property test: 1000 random bigint amounts → no float drift, no precision loss.

### 4. Org isolation
- Scenario test: create two orgs A and B; perform every billing action on A; assert B's subscription/ledger unchanged.

### 5. Configurable trial
- Set `billing_config.trial_days = 7`. New signup → trial ends in 7 days.
- Set back to 14. New signup → trial ends in 14 days.

### 6. i18n
- Each billing error returned in fr + ar; localized correctly.

### 7. Coverage + regression
- 100% on touched files; no regressions.

## Pass criteria
- [ ] All scenarios pass.
- [ ] Money stays bigint.
- [ ] Org isolation holds.
- [ ] Trial length runtime-configurable.
- [ ] No regressions.

## On failure
- Re-open `37-subscription-manager-trial-and-payg.md`; fix; rerun.
- Do NOT advance to prompt 39 until this validation passes.

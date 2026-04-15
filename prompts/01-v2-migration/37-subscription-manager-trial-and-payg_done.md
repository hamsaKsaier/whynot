# Subscription manager: trial, BYO-keys vs Managed+PAYG, billing service

## Agent
`api-designer` (lead) + skill `audit-logging`

## Depends on
`36-validate-stripe-webhook.md`

## Goal
Implement subscription lifecycle (trial, upgrade, downgrade, cancel, reactivate, fail, prorate) and the PAYG charging path. Tier model: `byo_keys` (subscription only, no metered AI cost) vs `managed_payg` (subscription + metered PAYG charges for AI usage).

## Single source of truth
`ARCHITECTURE.md` section 9.

## Reference
- `/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/subscriptions/subscription-manager.ts`
- `/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/marketplace/billing-service.ts`

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Pricing source
- `shared/constants/pricing.ts`:
  ```ts
  export const PLANS = {
    free: { name: 'Free', monthlyCents: 0n, tier: 'byo_keys' },
    pro_byo: { name: 'Pro (Bring Your Own Keys)', monthlyCents: 2900n, tier: 'byo_keys' },
    pro_managed: { name: 'Pro (Managed + PAYG)', monthlyCents: 4900n, tier: 'managed_payg' },
  } as const;
  ```
- Allow `billing_config.payg_rates` JSON to override per-event PAYG rates at runtime.

### 2. SubscriptionManager
- `gateway/src/payments/subscription-manager.ts`:
  - `startTrial({ orgId, plan })` — honors `billing_config.trial_days`
  - `upgrade({ orgId, plan })` — handles BYO-keys vs Managed+PAYG transitions; prorates
  - `downgrade({ orgId, plan })` — schedules at period end
  - `cancel({ orgId, atPeriodEnd })`
  - `reactivate({ orgId })`
  - `markPaymentFailed({ orgId, paymentIntentId })`
  - `expireTrial({ orgId })` — invoked from a daily worker (worker creation NOT in scope; cron lands later)
  - `isWithinTrial(orgId)` / `isManagedPaygTier(orgId)` helpers
- Org-scoped. Audit-logged.

### 3. BillingService (PAYG)
- `gateway/src/payments/billing-service.ts`:
  - `recordUsageEvent({ orgId, eventType, quantity, metadata })` — looks up rate from `billing_config.payg_rates`, computes `delta_cents = -(rate * quantity)`, appends to `payg_credits_ledger`.
  - `currentPaygBalance(orgId): Promise<bigint>` — sums the ledger.
  - `topUp({ orgId, amountCents, paymentIntentId })` — appends a positive ledger entry after Stripe payment confirmed.
  - `chargeIfNeeded(orgId)` — if balance < 0 and Managed+PAYG tier, triggers a Stripe payment intent for the deficit + a buffer.
- All math bigint.

### 4. Endpoints
- `POST /api/me/billing/checkout` (creates checkout session via PaymentService)
- `POST /api/me/billing/upgrade`, `/downgrade`, `/cancel`, `/reactivate`
- `GET /api/me/billing/subscription` (current subscription + trial status)
- `GET /api/me/billing/balance` (PAYG ledger sum)
- `POST /api/me/billing/topup`

### 5. i18n
- Add `errors:billing.*`, `success:billing.*`, `emails:billing.*` keys (5 languages).

### Files to create/modify
- `shared/constants/pricing.ts` — new
- `gateway/src/payments/subscription-manager.ts` — new
- `gateway/src/payments/billing-service.ts` — new
- `gateway/src/api/me/billing.ts` — new (the endpoints above)
- `gateway/src/i18n/translations/{en,ar,fr,de,es}/{errors,success,emails}.json` — new keys

### Tests
- Supertest end-to-end scenarios:
  1. Free → trial Pro BYO → expiry → downgrade to Free
  2. Free → trial Pro Managed → upgrade → ledger usage event → balance negative → topup → balance positive
  3. Pro BYO → downgrade scheduled → period end → applies
  4. Pro Managed → cancel at period end → reactivate before end-of-period
  5. Failed payment → marks subscription past_due → grace period
  6. Cross-org isolation: org A actions never affect org B
  7. Trial length configurable: change `billing_config.trial_days` to 7, new signups honor 7-day trial
  8. Proration: upgrade mid-cycle prorates correctly
- Property test on bigint money math (no float drift).
- Coverage: 100% on touched files.

### i18n
- All endpoint error/success messages localized.

### Documentation
- `docs/{en,ar,fr,de,es}/payments/subscriptions.md` — explains lifecycle + tier model
- `docs/{en,ar,fr,de,es}/payments/payg.md` — explains the credit ledger + topup model

### Acceptance criteria
- [ ] All 8 lifecycle scenarios pass.
- [ ] Trial length is read from `billing_config` at runtime (not a constant).
- [ ] PAYG ledger sums correctly to balance.
- [ ] Org isolation enforced.
- [ ] Money math bigint throughout.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.

# Payment service core + Stripe provider

## Agent
`api-designer` (lead) + skill `audit-logging`

## Depends on
`32-validate-payments-schema.md`

## Goal
Port the reference `payment-service.ts` into `gateway/src/payments/payment-service.ts` and add a Stripe provider wrapper with retry + idempotency. Replace (delete) the existing gateway billing code in the same change so we don't end up with two payment paths.

## Single source of truth
`ARCHITECTURE.md` section 9.

## Reference
- `/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/payments/payment-service.ts`

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Inventory existing billing code
- Locate all current files in `gateway/src/` that handle Stripe / billing / credits.
- Mark them for deletion at the end of this prompt.

### 2. Stripe provider wrapper
- `gateway/src/payments/stripe-provider.ts`:
  - Wraps the official `stripe` SDK.
  - Adds exponential-backoff retry (max 3) for transient errors.
  - Generates and forwards idempotency keys for create operations.
  - Single configuration source: env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).

### 3. PaymentService class
- `gateway/src/payments/payment-service.ts`:
  - `createCheckoutSession({ orgId, plan, tier, successUrl, cancelUrl })`
  - `createSubscription({ orgId, plan, tier })` — creates subscription rows + Stripe subscription
  - `handleWebhook(event)` — dispatches by event type
  - `refund({ paymentIntentId, amountCents? })`
  - `chargePayg({ orgId, amountCents, reason, relatedEventId? })` — writes a payg_credits_ledger row + Stripe payment intent
  - All money math operates on bigint; never coerce to Number.
- Audit-log every public method call with actor, action, payload (no card data, no PII).

### 4. Repositories
- `shared/database/repositories/subscription-repository.ts`
- `shared/database/repositories/payment-transaction-repository.ts`
- `shared/database/repositories/billing-history-repository.ts`
- `shared/database/repositories/payg-credits-ledger-repository.ts`
- `shared/database/repositories/billing-config-repository.ts`

### 5. Delete legacy billing code
- Remove the files identified in step 1 in the same commit. No backwards-compat shims.
- Update any imports across `gateway/src/` and `frontend/src/` to point to the new modules.

### Files to create/modify
- `gateway/src/payments/payment-service.ts` — new
- `gateway/src/payments/stripe-provider.ts` — new
- `shared/database/repositories/{subscription,payment-transaction,billing-history,payg-credits-ledger,billing-config}-repository.ts` — new
- Legacy gateway billing files — deleted
- `ARCHITECTURE.md` — section 9 updated with module paths

### Tests
- Unit:
  - `formatCents`, money arithmetic stays bigint (no float drift on large values).
  - Retry wrapper retries N times then surfaces error.
  - Idempotency key generation deterministic per logical operation.
- Supertest: each public PaymentService method against a stubbed Stripe (use the official `stripe-mock` or a hand rolled fake).
- Snapshot of normalized error envelopes.
- Coverage: 100% for touched files.

### i18n
- All user-visible payment errors via `req.t('errors:payments.*')` keys; add to all 5 languages.

### Documentation
- `docs/{en,ar,fr,de,es}/payments/payment-service.md` — explains the public API + the bigint rule.

### Acceptance criteria
- [ ] Legacy billing code deleted; no dead imports.
- [ ] All money math bigint.
- [ ] Retry + idempotency verified.
- [ ] All Stripe interactions audit-logged (without card data).
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.

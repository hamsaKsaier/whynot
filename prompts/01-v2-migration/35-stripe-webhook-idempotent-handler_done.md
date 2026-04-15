# Stripe webhook handler with signature verification + idempotency

## Agent
`api-designer` (lead) + skill `audit-logging`

## Depends on
`34-validate-payment-service-core.md`

## Goal
Implement `POST /api/webhooks/stripe`: verify signature, dedupe by event ID via `payment_webhooks_idempotency`, dispatch to `PaymentService.handleWebhook`, and log every dispatch.

## Single source of truth
`ARCHITECTURE.md` section 9.

## Reference
`/home/serverlessbase/serverless-v2/serverlessbase/apps/serverlessbase/pages/api/stripe/webhook.ts`

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Route
- `gateway/src/api/webhooks/stripe.ts`:
  - **Raw body** parser (Stripe signature requires the raw bytes — wire a route-specific middleware before the global JSON parser).
  - Verify `stripe-signature` header via `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`.
  - On verification failure → 400.
  - Insert into `payment_webhooks_idempotency(event_id)` with `ON CONFLICT (event_id) DO NOTHING`. If 0 rows affected, this is a duplicate → return 200 immediately.
  - Otherwise call `paymentService.handleWebhook(event)`.
  - Update `handled_at` after successful dispatch.
  - Always return 200 once the dispatch is complete (Stripe expects 2xx; non-2xx triggers retries).
- Wire the route in `gateway/src/app.ts` BEFORE the JSON body-parser middleware.

### 2. Logging
- Log: event id, event type, dedupe hit/miss, dispatch outcome.
- Audit row for non-trivial side effects (subscription state changes, refunds).

### Files to create/modify
- `gateway/src/api/webhooks/stripe.ts` — new
- `gateway/src/middleware/raw-body.ts` — new (or use an existing equivalent)
- `gateway/src/app.ts` — wire raw-body middleware for the webhook route only

### Tests
- Supertest:
  - Valid signature + new event → 200, dispatch happens once, idempotency row inserted.
  - Same event replayed → 200, dispatch NOT called again.
  - Invalid signature → 400.
  - Unknown event type → 200 (logged + ignored, no exception).
  - Malformed JSON / wrong content type → 400.
- Concurrency: fire 5 parallel requests with the same event id → exactly one dispatch.
- Coverage: 100% for touched files.

### i18n
- Webhook responses are not user-facing; no localization needed.

### Documentation
- `docs/{en,ar,fr,de,es}/payments/webhooks.md` — explains the dedupe contract, the 2xx-always rule, the raw-body requirement.

### Acceptance criteria
- [ ] Signature verified; bad signatures return 400.
- [ ] Replay of the same event id is a no-op.
- [ ] Concurrent replays produce exactly one dispatch.
- [ ] Unknown event types do not crash.
- [ ] Coverage 100% for touched files.
- [ ] No untouchable path changes.

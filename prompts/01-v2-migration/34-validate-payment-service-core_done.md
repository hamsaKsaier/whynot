# Validate: Payment service core + Stripe provider

## Agent
`api-designer` (verifier)

## Depends on
`33-payment-service-core-and-stripe-provider.md`

## Goal
Verify the payment service public surface, money is bigint end-to-end, retry/idempotency works, and the legacy billing code is gone.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Unit tests pass; coverage 100% on touched files.

### 2. Money arithmetic
- Run a property test: random bigint amounts up to 2^53; assert no float coercion anywhere in the path.

### 3. Retry + idempotency
- Stub Stripe to return 5xx twice then 200; assert the wrapper retries and succeeds.
- Stub Stripe to return 5xx four times; assert the wrapper surfaces the error after 3 retries.
- Idempotency key for the same logical operation is identical on repeated calls.

### 4. Legacy code gone
- `git ls-files gateway/src/ | xargs grep -l 'old-billing-module-name'` → no results (substitute the actual legacy module names from prompt 33's inventory).

### 5. Audit
- Each PaymentService method writes an audit row without card data or PII.

### 6. i18n
- Localized error envelopes for each public method in fr + ar.

### 7. Untouchable path audit
- No diffs in v2 / mcp-browser / existing migrations.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] Money path stays bigint everywhere.
- [ ] Retry + idempotency correct.
- [ ] Legacy billing gone.
- [ ] 100% coverage on touched files.
- [ ] No regressions; no untouchable path changes.

## On failure
- Re-open `33-payment-service-core-and-stripe-provider.md`; fix; rerun.
- Do NOT advance to prompt 35 until this validation passes.

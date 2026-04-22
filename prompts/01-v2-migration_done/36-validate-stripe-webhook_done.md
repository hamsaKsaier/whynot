# Validate: Stripe webhook handler

## Agent
`api-designer` (verifier)

## Depends on
`35-stripe-webhook-idempotent-handler.md`

## Goal
Verify signature checks, idempotency, concurrency safety, and graceful handling of unknown event types.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Unit tests pass; coverage 100% on touched files.

### 2. Supertest scenarios
- Valid signature + new event → 200; one dispatch; idempotency row created with `handled_at` set.
- Same event id replayed → 200; dispatch counter unchanged.
- Bad signature → 400.
- Unknown event type → 200, no thrown exception, log line present.
- Empty/non-JSON body → 400.

### 3. Concurrency
- Fire 5 parallel requests with the same event id; assert exactly one dispatch by inspecting a counter inside the stub `PaymentService.handleWebhook` mock.

### 4. Architecture doc
- `ARCHITECTURE.md` section 9 mentions the webhook route + dedupe + raw-body requirement.

### 5. Untouchable path audit
- No diffs in v2 / mcp-browser / existing migrations.

## Pass criteria
- [ ] All scenarios pass.
- [ ] Concurrency safe.
- [ ] No regressions.
- [ ] Coverage 100% on touched files.

## On failure
- Re-open `35-stripe-webhook-idempotent-handler.md`; fix; rerun.
- Do NOT advance to prompt 37 until this validation passes.

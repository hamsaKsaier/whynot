# Validate: Usage events schema + tracker

## Agent
`api-designer` (verifier)

## Depends on
`57-usage-events-schema-and-tracker.md`

## Goal
Verify the table exists, the tracker batches and flushes correctly, every metered endpoint produces events, and PAYG charges flow.

## Validation steps

### 1. Migration apply
- Apply migration; assert table + indexes via `pg_indexes`.

### 2. Tracker behaviour
- Unit: enqueue 99 events → no flush; enqueue 100th → batch flush.
- Unit: enqueue 1 event → wait flush interval → row inserted.
- Unit: SIGTERM handler flushes pending buffer.

### 3. Metered endpoints
- For each endpoint identified in prompt 57, run a successful request and assert one new row in `usage_events` with the right `event_type`, `organization_id`, `user_id`, `quantity`, `metadata`.

### 4. PAYG linkage
- Set up a Managed+PAYG tier org. Trigger a metered action. Assert:
  - `usage_events` row inserted.
  - `payg_credits_ledger` row appended with `delta_cents = -(rate * quantity)`.
- Same action for a BYO-keys tier org → only `usage_events` row, no ledger debit.

### 5. Org isolation
- Trigger events on org A; aggregate query for org B returns zero.

### 6. Untouchable path audit
- No diffs in v2 / mcp-browser / existing migrations.

### 7. Coverage + regression
- 100% on touched files; no regressions.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] Tracker batches + flushes.
- [ ] Every metered endpoint produces an event.
- [ ] PAYG flow correct.
- [ ] Org isolation enforced.
- [ ] No regressions; no untouchable path changes.

## On failure
- Re-open `57-usage-events-schema-and-tracker.md`; fix; rerun.
- Do NOT advance to prompt 59 until this validation passes.

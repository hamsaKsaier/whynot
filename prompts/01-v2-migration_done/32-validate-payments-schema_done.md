# Validate: Payments schema migration

## Agent
`api-designer` (verifier)

## Depends on
`31-payments-schema-migration.md`

## Goal
Verify the migration applies, every money column is bigint, and the seed is idempotent.

## Validation steps

### 1. Migration apply
- `docker compose -f docker-compose.test.yml run --rm db-migrate` → exit 0.
- Introspect `information_schema.columns` and assert:
  - `payment_transactions.amount_cents` → `bigint`
  - `billing_history.amount_cents` → `bigint`
  - `payg_credits_ledger.delta_cents` → `bigint`
- Assert all FKs present, all indexes present.

### 2. Seed idempotency
- Run the seed script twice; assert one row in `billing_config` after both runs.

### 3. Architecture doc
- `ARCHITECTURE.md` section 9 lists every new table and asserts the bigint-cents rule.

### 4. Untouchable path audit
- No edits to existing migration files.
- No edits to v2 / mcp-browser.

## Pass criteria
- [ ] Migration applies.
- [ ] All money columns bigint.
- [ ] Seed idempotent.
- [ ] `ARCHITECTURE.md` section 9 accurate.
- [ ] No untouchable path changes.

## On failure
- Re-open `31-payments-schema-migration.md`; fix; rerun.
- Do NOT advance to prompt 33 until this validation passes.

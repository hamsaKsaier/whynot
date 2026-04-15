# Validate: Feature flags schema, registry, seeds

## Agent
`api-designer` (verifier)

## Depends on
`21-feature-flags-schema-and-registry.md`

## Goal
Verify the migration applies, the registry compiles and exports correct types, and the seed runs idempotently.

## Validation steps

### 1. Migration apply + rollback
- `docker compose -f docker-compose.test.yml run --rm db-migrate` → exit 0
- Introspect `pg_tables` and `information_schema.columns`; assert the two tables and all expected columns/types.
- Manually drop the tables in a scratch DB and re-run; assert idempotency.

### 2. Registry tests
- `bun vitest run shared/constants/__tests__/platform-features.test.ts` → pass

### 3. Seed tests
- Run seed twice, assert row count unchanged after second run; assert default_enabled values match the registry.

### 4. Type checks
- `bun typecheck` across packages that import the registry → exit 0.

### 5. Architecture doc
- `ARCHITECTURE.md` section 10 reflects the actual schema.

## Pass criteria
- [ ] Migration applies + idempotent.
- [ ] Registry compiles and exports types.
- [ ] Seeds idempotent.
- [ ] `ARCHITECTURE.md` section 10 accurate.
- [ ] No regressions.

## On failure
- Re-open `21-feature-flags-schema-and-registry.md`; fix; rerun this validation.
- Do NOT advance to prompt 23 until this validation passes.

# Validate: Feature flags backend (util, middleware, audit)

## Agent
`api-designer` (verifier)

## Depends on
`23-feature-flags-backend-util-middleware.md`

## Goal
Verify the backend feature-flag layer works: cache correctness, middleware gating, mutation audit, localized errors.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- `bun vitest run gateway/src/utils/feature-flags.test.ts` → pass
- Cache test cases: cold miss, warm hit, TTL eviction, manual invalidation, org-wide invalidation.

### 2. Middleware behavior
- Supertest: protected route + flag enabled → 200.
- Flag disabled → 403, body `error.code === 'FEATURE_DISABLED'`, `error.message` localized for `Accept-Language: fr` and `ar`.
- Unknown flag key in code → 500 with `errors:flags.unknownKey` (defensive only; should never trigger in prod).

### 3. Mutation endpoints
- Supertest: `PUT /api/admin/feature-flags/:orgId/:key` happy path → 200, audit row created with before/after.
- Same key set twice with same value → still creates audit row (or skips — match the impl decision and document it).
- `DELETE` clears override; subsequent `GET /api/me/flags` for that org returns the default.
- Cross-org access from non-superadmin → 403 (note: full superadmin gating arrives in phase 8, but org-scoping must already exist).

### 4. `/api/me/flags`
- Returns the resolved map. Toggling a flag and re-fetching reflects within TTL window or after explicit invalidation.

### 5. Coverage
- Touched files at 100% line/branch/function coverage.

### 6. Regression scan
- Earlier-phase suites still green.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] Cache behaviour correct.
- [ ] Middleware blocks + localizes.
- [ ] Audit log row on every mutation.
- [ ] Coverage 100% for touched files.
- [ ] No regressions.

## On failure
- Re-open `23-feature-flags-backend-util-middleware.md`; fix; rerun.
- Do NOT advance to prompt 25 until this validation passes.

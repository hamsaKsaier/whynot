# Recon — Backend unit tests (gateway + repositories)

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/spec-driven-development/`
- Rules: `.claude/rules/recon-safety.md` (A7)

## Dependencies
- All of Section B and Section C.

## Task
Drive 100% line + branch coverage on every Recon backend file. This prompt closes coverage gaps left by the per-feature tests in B and C.

### 1. Coverage scope
- All files under `gateway/src/api/recon/**`
- All files under `gateway/src/middleware/recon-*`
- All Recon-related changes in `gateway/src/services/billing-service.ts`
- All files under `shared/database/repositories/recon-*`
- New constants in `shared/constants/pricing.ts` and `shared/constants/platform-features.ts`

### 2. Test cases — endpoint matrix
For each endpoint in C6 (`POST/GET /api/recon/scans`, GET findings/report, POST cancel/resume), assert the following:

| Scenario | Expected |
|---|---|
| Anonymous request | 401 + `errors:auth.required` |
| Auth'd, flag off | 404 (NO body leakage) |
| Auth'd, flag on, plan without `recon_enabled` | 402 + `errors:recon.payment.required` |
| Auth'd, flag on, plan ok, wrong workspace | 404 (NOT 403 — leakage guard) |
| Auth'd, flag on, plan ok, no credits + 0 included | 402 |
| Auth'd, flag on, plan ok, has included quota | 200 |
| Create: missing authorization block | 400 + `errors:recon.authorization.required` |
| Create: justification 19 chars | 400 + `errors:recon.authorization.justification.tooShort` |
| Create: justification 1001 chars | 400 |
| Create: project without GitHub repo | 400 + `errors:recon.project.repoRequired` |
| Create: env without target_url | 400 + `errors:recon.environment.urlRequired` |
| Create: env tagged `production` | 200 + response includes `warnings[0].code === 'recon.environment.production'` |
| Create: 6th scan within an hour | 429 + `errors:recon.rateLimit.exceeded` |
| Resume: status `running` | 400 + `errors:recon.resume.invalidStatus` |
| Resume: URL mismatch | 400 + `errors:recon.resume.urlMismatch` |
| Cancel: already completed | 400 + `errors:recon.scan.invalidStatus` |
| Cancel: idempotent on already-cancelling | 200 |

### 3. Test cases — repository matrix
For each repository in B1, assert:
- Insert + read round-trip.
- Wrong-workspace query returns empty.
- Cascade delete on parent removal.
- Updated_at trigger fires (where applicable).
- CHECK constraints reject every illegal value (status enum, severity enum, vuln_class enum, justification length).

For `recon-finding-repository`:
- Dedup UPSERT keeps the highest-severity row; merges duplicates JSONB.
- Insert with `status='confirmed'` requires non-null PoC (assert at the repository level via TS types + a runtime guard test).

For `recon-scan-authorization-repository`:
- Insert is allowed.
- Update method does NOT exist on the repository.
- Direct SQL UPDATE attempt against the table is allowed by Postgres (we don't trigger here) but the repository never exposes it.

### 4. Coverage assertion
- `make shell-gateway npm test -- --coverage` must report 100% lines, 100% branches, 100% functions on every file listed in section 1.
- CI fails if any uncovered line is reported.

### 5. Mocking strategy
- Mock the recon-executor HTTP client at the gateway boundary (executor is tested separately in F2).
- Mock the LLMClient where it's referenced in unit tests (it's not — gateway doesn't call LLMs directly).
- Use `vitest`'s in-memory PostgreSQL fixtures (or whatever the project uses today — confirm in `gateway/src/__tests__/setup.ts`).

### Tests
- See section 2 + 3 above. Every case has its own `it(...)` block.

### i18n
- This prompt does not add new strings; it asserts the existing keys from B/C are returned correctly.
- Add a separate test that snapshots the translated string for at least one key per locale (per `errors`, `success`, `validation`, `billing` namespaces) to lock the translation in place.

### Documentation
- N/A.

### Files to modify
- New + extended test files under `gateway/src/__tests__/recon/`
- New + extended test files under `shared/database/repositories/__tests__/`

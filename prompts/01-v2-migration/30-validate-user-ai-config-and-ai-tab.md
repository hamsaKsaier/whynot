# Validate: User AI config and Settings > AI tab

## Agent
`api-designer` (verifier) + `design-ui-designer`

## Depends on
`29-user-ai-config-schema-and-endpoints.md`

## Goal
Verify encryption is correct, endpoints enforce auth + masking, audit logging never leaks secrets, and the UI flow works end-to-end through a real provider stub.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Encryption round-trip + tamper test → pass
- Boot fail-fast on missing key → pass

### 2. Endpoint security
- Supertest:
  - GET returns masked keys (regex assert against `^(sk-|key-).*•••••.{4}$`).
  - Cross-user GET/PUT/DELETE → 403.
  - POST without auth → 401.
  - Invalid provider → 400 with localized message in fr+ar.

### 3. Audit log invariant
- After every mutation, query `audit_log` for the row. Assert the JSON payload contains NEITHER the plaintext API key NOR a base64 ciphertext blob.

### 4. Test-connection
- With each provider stub, run the test endpoint; assert latency reported and no error in logs.

### 5. Default uniqueness
- Set provider A as default, then provider B; only B has `is_default = true`. Concurrency test: two parallel set-default calls leave the DB in a consistent state.

### 6. UI e2e
- Playwright: add OpenAI config → test connection (stub) → set default. Trigger a feature that calls `getUserAIModel` → network capture confirms the OpenAI stub URL was hit (not Anthropic).

### 7. Untouchable path audit
- `git diff` shows zero changes inside `services/qa-loop-executor/src/v2/` or `mcp-browser.ts`.

### 8. Coverage + regression
- 100% on touched files; no regressions.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] Plaintext key never appears in any GET response, log, or audit row.
- [ ] Default uniqueness enforced.
- [ ] UI flow works end-to-end.
- [ ] No untouchable path changes.
- [ ] No regressions.

## On failure
- Re-open `29-user-ai-config-schema-and-endpoints.md`; fix; rerun.
- Do NOT advance to phase 7 until this validation passes.

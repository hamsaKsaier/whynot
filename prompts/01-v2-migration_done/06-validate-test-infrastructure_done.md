# Validate: Test infrastructure works end-to-end inside Docker

## Agent
`api-designer` (verifier)

## Depends on
`05-setup-test-infrastructure.md`

## Goal
Verify every test runner starts inside Docker, every smoke test passes, coverage reports are generated, Playwright browsers are installed, and `ARCHITECTURE.md` section 15 matches reality.

## Validation steps

### 1. Compose file is valid
```bash
cd /home/serverlessbase/whynot
docker compose -f docker-compose.test.yml config > /dev/null || { echo "invalid compose"; exit 1; }
```

### 2. Postgres-test comes up and migrations apply cleanly
```bash
docker compose -f docker-compose.test.yml up -d postgres-test
# Wait up to 60s for pg_isready; then apply migrations via the repo's existing runner (do NOT edit migrations).
timeout 60 bash -c 'until docker compose -f docker-compose.test.yml exec postgres-test pg_isready -U postgres; do sleep 1; done'
# Apply all migrations in order. The repo has a script for this — find it first.
docker compose -f docker-compose.test.yml run --rm gateway-test bun run db:migrate || exit 1
```

### 3. Gateway vitest + supertest pass
```bash
docker compose -f docker-compose.test.yml run --rm gateway-test bun vitest run --coverage || exit 1
# Assert coverage directory exists.
test -d gateway/coverage || exit 1
test -f gateway/coverage/lcov.info || exit 1
```

### 4. Frontend vitest passes
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test bun vitest run --coverage || exit 1
test -d frontend/coverage || exit 1
```

### 5. Admin-frontend vitest passes
```bash
docker compose -f docker-compose.test.yml run --rm admin-frontend-test bun vitest run --coverage || exit 1
test -d admin-frontend/coverage || exit 1
```

### 6. Shared package vitest passes
```bash
docker compose -f docker-compose.test.yml run --rm gateway-test bash -c 'cd /app/shared && bun vitest run' || exit 1
```

### 7. Playwright smoke
```bash
# Playwright browsers install inside the image.
docker compose -f docker-compose.test.yml run --rm playwright bunx playwright install --with-deps chromium
# Smoke test may be test.skip() during phases 0–8; an empty run is acceptable.
docker compose -f docker-compose.test.yml run --rm playwright bunx playwright test || exit 1
```

### 8. axe-core + lighthouse binaries present
```bash
docker compose -f docker-compose.test.yml run --rm playwright bash -c 'node -e "require(\"@axe-core/playwright\")"' || exit 1
docker compose -f docker-compose.test.yml run --rm frontend-test bash -c 'bunx lighthouse --version' || exit 1
```

### 9. ARCHITECTURE.md section 15 reflects reality
```bash
# Every command listed in section 15 must be runnable without errors when dry-run.
grep -A 50 '^## .*Testing' ARCHITECTURE.md | grep -oE 'docker compose [^`]*' | while read cmd; do
  echo "dry-check: $cmd"
  # Parse-only; do not execute (some commands may be long-running).
  echo "$cmd" | grep -q 'docker compose -f docker-compose.test.yml' || { echo "malformed: $cmd"; exit 1; }
done
```

### 10. Cleanup and regression
```bash
docker compose -f docker-compose.test.yml down -v
# Confirm no stray containers from previous runs.
docker ps -a | grep -v CONTAINER || true
```

## Pass criteria
- [ ] `docker compose -f docker-compose.test.yml config` is valid.
- [ ] Postgres-test applies all migrations cleanly.
- [ ] Gateway vitest run + coverage report succeeds.
- [ ] Frontend vitest run + coverage report succeeds.
- [ ] Admin-frontend vitest run + coverage report succeeds.
- [ ] Shared vitest run succeeds.
- [ ] Playwright install + smoke run succeeds (empty/skipped allowed).
- [ ] axe + lighthouse importable/invocable.
- [ ] `ARCHITECTURE.md` section 15 lists the real, working commands.
- [ ] `docker compose down -v` cleans up without leaving orphans.

## On failure
- If Postgres migration runner is missing: document it in `ARCHITECTURE.md` section 4 as a TODO, add a shim in `scripts/` that calls `psql` on every migration file in order — do NOT edit migrations themselves.
- If Playwright browsers fail to install: check base image (use `mcr.microsoft.com/playwright:v1.48.0-jammy` specifically — older images miss `--with-deps` flag).
- If vitest has no tests to run: confirm smoke files exist at the paths listed in prompt 05. Re-open prompt 05.
- Re-run this validation until every check passes. Do NOT advance to prompt 07 until pass.

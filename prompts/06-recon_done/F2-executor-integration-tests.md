# Recon — Executor integration tests

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/pentest-orchestration/` (A3), `.claude/skills/exploit-safety/` (A4), `.claude/skills/finding-severity/` (A5)
- Rules: `.claude/rules/recon-safety.md` (A7)

## Dependencies
- All of Section C.

## Task
Drive 100% coverage on the recon-executor service and validate the full pipeline against a pinned, intentionally-vulnerable target running in a dedicated docker-compose profile.

### 1. Test target
- Add `docker/compose/docker-compose.test.yml` (or extend an existing test profile) with a `juice-shop` service:
  ```yaml
  juice-shop:
    image: bkimminich/juice-shop:v15.0.0
    ports: ['3014:3000']
    profiles: ['test']
  ```
- Pin to a specific version so the test results are reproducible.
- Make target: `make test-recon-integration` brings up only `database`, `gateway`, `recon-executor`, `juice-shop`, runs the test suite, tears down.

### 2. Test scenarios

| # | Scenario | Assertion |
|---|---|---|
| 1 | Full happy path against juice-shop | Scan completes; ≥3 confirmed findings across ≥2 vuln classes; report generated |
| 2 | Cancellation mid-discovery | Scan ends in `cancelled`; phases 1 = completed, 2 = cancelled, 3–5 = pending; PAYG events: phase_fingerprinting only |
| 3 | Authorization missing (executor receives a scan with no auth row) | Phase 4 aborts; scan status `failed` with `error_message='authorization_missing'` |
| 4 | Stuck detection | Manually pause the executor mid-phase-3 (SIGSTOP → wait > 5min in compressed time → SIGCONT); scan status flips to `stuck` |
| 5 | Resume after `failed` at phase 3 | Resumed scan re-runs phase 3 only; phases 1+2 not re-run; final status `completed` |
| 6 | Resume URL mismatch | Gateway rejects with 400; executor never invoked |
| 7 | Per-phase billing on partial cancellation | Workspace credit balance decremented by exactly the per-phase event sum |
| 8 | Per-vuln-class agent partial failure | Inject a fault into the `injection` agent; other 4 agents still produce hypotheses; phase status = `completed` |
| 9 | "No exploit, no report" gate | Plant a hypothesis whose exploit always fails; assert it appears in `recon_findings` with `status='discarded_unprovable'` and is NOT in the final report |
| 10 | Banned-vocabulary scrubber | Plant a hallucinated "powered by Shannon" line in the LLM mock for the report phase; assert it is removed |
| 11 | Egress controls | Configure a hypothesis that targets `http://10.0.0.1`; assert the browser refuses unless the original target_url itself is in 10.x |
| 12 | Payload redaction | Run a scan; grep the executor's INFO+ logs; assert no SQLi/XSS/SSRF payload patterns leaked |

### 3. Coverage assertion
- `make shell-recon-executor pytest --cov=app --cov-fail-under=100`
- Coverage gate: 100% lines, 100% branches.

### 4. Determinism
- Mock the LLMClient via a recorded-fixture replay for tests 1, 5, 8, 9, 10. Real LLM calls are not allowed in CI.
- juice-shop is deterministic per pinned version, but assertions tolerate small ordering variation in finding lists.

### Tests
Implemented as the test cases in section 2. Use `pytest` fixtures + `pytest-asyncio`.

### i18n
- N/A — executor service has no user-facing strings (per C1).
- However, assert that the report templates exist for all 5 langs (file existence check).

### Documentation
- N/A.

### Files to modify
- `docker/compose/docker-compose.test.yml`
- `Makefile` (new target)
- `services/recon-executor/tests/integration/test_*.py`
- `services/recon-executor/tests/fixtures/llm-replays/*.json`

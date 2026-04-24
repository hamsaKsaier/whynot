# Recon — New `services/recon-executor/` service

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/pentest-orchestration/` (A3), `.claude/skills/exploit-safety/` (A4)
- Supporting: `.claude/skills/whynot-dashboard/`
- Rules: `.claude/rules/recon-safety.md` (A7)

## Dependencies
- A1, A3, A4, A7, B1, B2, B3, B4

## Task
Create a new Python FastAPI service `services/recon-executor/` that runs the 5-phase Recon pipeline. Follow the architectural pattern of `services/qa-loop-executor/` (sync HTTP entry, DB-status checkpointing, no Temporal). Reuse the shared `LLMClient` from `services/ai-service/`.

### 1. Service skeleton
- `services/recon-executor/Dockerfile`
- `services/recon-executor/pyproject.toml` (or requirements.txt — match the ai-service convention)
- `services/recon-executor/app/main.py` — FastAPI app with `/health` + `/api/recon/sessions` endpoints
- `services/recon-executor/app/orchestrator.py` — phase-state-machine driver (per A3)
- `services/recon-executor/app/phases/{fingerprinting,discovery,vuln_analysis,exploitation,reporting}.py`
- `services/recon-executor/app/checkpoint.py` — DB checkpoint helpers (per A3 reference)
- `services/recon-executor/app/safety.py` — payload redaction + prompt-injection wrapper (per A4)
- `services/recon-executor/app/clients/{db,gateway,llm}.py` — typed clients

### 2. Dockerfile
Base on `python:3.12-slim`. Install:
- `nmap`, `subfinder` (from official binaries), `whatweb` (Ruby gem or static), `schemathesis` (pip)
- `playwright` + browser binaries (`playwright install chromium --with-deps`)
- Non-root user
- Health check: `HEALTHCHECK CMD curl -f http://localhost:8001/health || exit 1`

Note: image is large (~1 GB). Add a multi-stage build to keep the runtime image lean.

### 3. docker-compose integration
- Add `recon-executor` to `docker/compose/docker-compose.yml`:
  - Port `3013 → 8001`
  - Depends on `database` (healthy) + `gateway` (healthy)
  - Mount: scanned-repo path is read-only (mirror the upstream tool's safety posture)
  - Env: `LLM_PROVIDER`, `GATEWAY_INTERNAL_URL`, `DATABASE_URL`
  - Health check
- Add Makefile targets: `make shell-recon-executor`, `make logs-recon-executor`.

### 4. Orchestrator entry
```python
@app.post("/api/recon/sessions")
async def start_session(req: StartSessionRequest) -> StartSessionResponse:
    # Validate scan exists + status == 'pending'
    # Spawn background task running the 5-phase pipeline
    # Return immediately with 202 Accepted
```
Background task uses `asyncio.create_task` with a top-level exception handler that writes `recon_scans.status = 'failed'` + `error_message` on uncaught errors.

### 5. Heartbeat + cancellation
Per A3:
- Every 30s, write `recon_scans.last_heartbeat_at = now()`.
- Every 10s, poll `recon_scans.cancel_requested_at`. If set, finish in-flight tool call, write phase as `cancelled`, exit cleanly.

### 6. Banned vocabulary
Internal code may reference tool names (`nmap`, etc.) — that's fine. Per `.claude/rules/recon-safety.md` rule #6, none of these names may surface in user-facing strings. Tag any code path that builds user-facing messages with `# user-visible:` and audit those separately.

### Tests
- Service smoke: `GET /health` returns 200.
- Orchestrator unit tests with mocked DB + mocked LLMClient:
  - Happy path runs all 5 phases in order.
  - Failure in phase 3 marks phases 4–5 as `skipped` (not run), scan status `failed`.
  - Cancellation mid-phase-3 finishes the current tool call, writes phase `cancelled`, scan status `cancelled`.
  - Heartbeat writes occur every 30s (use freezegun or asyncio time mock).
  - Stuck detection: no heartbeat for >5min → status `stuck` (logical-time test).
- Safety unit tests:
  - Payload redactor masks each class (SQLi, XSS, SSRF) in log output.
  - Prompt-injection wrapper is present in every LLM call that ingests repo content.
- 100% coverage on new Python files.

### i18n
- Service is internal — no user-facing strings. Errors propagate as i18n keys (e.g. `errors:recon.executor.unavailable`) which the gateway translates.

### Documentation
- N/A at the service level. Operator docs in G2.

### Files to modify
- New service tree under `services/recon-executor/`
- `docker/compose/docker-compose.yml`
- `Makefile`

# Recon — Resume from last completed phase

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/pentest-orchestration/` (A3), `.claude/skills/exploit-safety/` (A4)
- Rules: `.claude/rules/recon-safety.md` (A7)

## Dependencies
- A1, A3, A4, A7, B1, C1, C2, C3, C4, C5, C6

## Task
Implement scan resume so an interrupted or failed scan can pick up from the last successfully completed phase, without re-running expensive earlier phases. Per `.claude/rules/recon-safety.md` rule #5, resume requires URL match.

### 1. Gateway endpoint behavior (already declared in C6)
`POST /api/recon/scans/:id/resume`:
1. Load scan; reject with 404 if not in caller's workspace.
2. Reject with 400 if scan status ∈ {`pending`, `running`, `completed`} (only `failed`, `cancelled`, `stuck` are resumable).
3. Reject with 400 if `request.target_url !== scan.target_url`.
4. Reset scan: `status='pending'`, `cancel_requested_at=NULL`, `error_message=NULL`.
5. POST to executor: `POST http://recon-executor:8001/api/recon/sessions { scan_id, resume: true }`.

### 2. Executor resume logic (`services/recon-executor/app/orchestrator.py`)
On `resume=true`:
- Read all `recon_scan_phases` for the scan, ordered by phase order.
- Find the highest-numbered phase with `status='completed'` (call it `last_done`).
- Load that phase's `output_artifact_id` and pass it as input to the next phase.
- If `last_done` is `reporting`, the scan is already complete — return without doing anything (defensive — gateway should have prevented this).
- Otherwise, run phases `(last_done + 1) ... reporting` normally.

### 3. Artifact integrity check
Before resuming, verify the artifact for `last_done` is readable from blob storage (size > 0, JSON parses if `kind='json'`). If corrupted, reset that phase to `pending` and re-run from there.

### 4. Authorization re-check
Resume does NOT re-prompt for authorization (the original `recon_scan_authorizations` row remains valid for the lifetime of the scan). However, the gateway re-checks that the row exists; if it was deleted, reject the resume.

### 5. Billing on resume
Per B3: if a scan was billed for partial phases on its first attempt and now completes via resume, the orchestrator records the remaining per-phase events (not the full `recon_scan_run` event) so we don't double-charge.

### Tests
- Resume after `failed` at phase 3 picks up at phase 3 (re-runs it; phases 1+2 not re-run).
- Resume after `cancelled` at phase 4 picks up at phase 4.
- Resume after `stuck` (no heartbeat) picks up at the phase that was running when it stuck.
- URL mismatch → 400 from gateway.
- Authorization row deleted → 400 from gateway.
- Corrupted artifact → re-runs the affected phase.
- Billing accounting: first attempt billed phases 1+2; resume that completes phases 3–5 bills 3+4+5 (NOT a full `recon_scan_run` — that would double-charge).
- 100% coverage on new code paths.

### i18n
- Backend (gateway, 5 locales):
  - `errors:recon.resume.urlMismatch` (already added in C6)
  - `errors:recon.resume.invalidStatus` — "Cannot resume a scan with status {{status}}"
  - `errors:recon.resume.authorizationMissing` — "Original authorization no longer on file"
  - `success:recon.scan.resumed` (already added in C6)

### Documentation
- E3: "Resuming an interrupted scan" subsection in the Quickstart page.

### Files to modify
- `gateway/src/api/recon/resume.ts` (or wherever C6 placed the handler)
- `services/recon-executor/app/orchestrator.py`
- Tests
- Gateway locale files

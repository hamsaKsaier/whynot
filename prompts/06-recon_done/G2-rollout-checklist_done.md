# Recon — Rollout checklist & on-call runbook

## Agent
`recon-engineer` (A1) writes the runbook content. No code change in production paths.

## Skills
- Primary: `.claude/skills/spec-driven-development/`
- Rules: `.claude/rules/recon-safety.md` (A7)

## Dependencies
- All of A–G1.

## Task
Produce the post-merge rollout checklist + the on-call runbook for Recon. Both live in the operator-docs area (NOT customer-facing `/docs/recon/`).

### 1. Rollout checklist
- File: `docs/internal/recon-rollout.md` (or wherever the project keeps internal ops docs — find via `grep -r 'rollout\|runbook' docs/`).
- Sections:
  - **Pre-merge checks** — link to F1–F6; CI must be green.
  - **Database migration** — `make migrate` must succeed in staging; verify all 5 new tables + 1 column addition exist; verify default rows in `feature_flags`.
  - **Service rollout** — bring up `recon-executor` first; smoke-test `/health`; then deploy gateway + frontend.
  - **Flag enablement** — initial rollout: enable `recon_enabled` for the internal Acme test workspace; smoke-test with a real scan against the canary target. Then 10% rollout via `feature_flags.rollout_percent`. Then 100%.
  - **Monitoring** — link to dashboards + alert rules (section 3).
  - **Rollback plan** — set `recon_enabled` rollout_percent to 0 (instant). The flag-off path returns 404 cleanly per A7 rule #7.

### 2. On-call runbook
- File: `docs/internal/recon-runbook.md`.
- One section per known failure mode:

  **Scan stuck (no heartbeat > 5 min)**
  - Symptom: `recon_scans.status='stuck'`; UI shows stuck banner.
  - Diagnose: `kubectl logs recon-executor` (or `make logs-recon-executor`); look for the scan_id; check whether the LLM API is responding.
  - Mitigate: User can click "Resume"; if the executor is wedged, restart the pod (`kubectl rollout restart deployment/recon-executor`).

  **Cost overrun**
  - Symptom: PAYG dashboards show > $X spend in 1 hour.
  - Diagnose: query `recon_scans` for the offending workspace; look for runaway hypothesis counts in `recon_findings`.
  - Mitigate: lower `recon_monthly_scans` quota for the workspace; or set per-workspace flag override to off.

  **Exploit produced unexpected target mutation**
  - Symptom: customer reports unexpected data changes after a scan.
  - Diagnose: pull `recon_scan_artifacts` for the scan; review the exploitation phase log.
  - Mitigate: confirm authorization audit row was present; advise customer that white-box pentesting can mutate state per docs; consider tightening per-class rate limits if a class repeatedly causes issues.

  **LLM provider outage**
  - Symptom: phase 3 / 4 fails with `error_message` like "LLM unavailable".
  - Mitigate: the existing AI provider factory (commit `7ca5f41`) has retry + fallback. If both providers are down, customer scans fail; communicate via status page.

  **Scanned repo content triggered prompt injection**
  - Symptom: weird LLM output, suspect content in finding descriptions.
  - Mitigate: confirm the prompt-injection wrapper from A4 is being applied (grep for `<repo_file>` in the executor's logged prompts); if missing, this is a regression — file a P0 incident.

### 3. Monitoring & alerts
- Dashboards (Grafana / equivalent — find via `grep -r 'grafana\|datadog' docs/`):
  - Recon scans/hour
  - Recon scans by status (stacked)
  - Avg scan duration by phase
  - Avg cost per scan (credits)
  - LLM error rate during Recon scans
  - Per-workspace scan count (top 10)
- Alerts:
  - `recon_executor_unhealthy` — `/health` failing for > 5 min.
  - `recon_scans_stuck_count > 5` over 1 hour.
  - `recon_scan_failure_rate > 30%` over 1 hour.
  - `recon_payg_spike` — workspace PAYG charges > $200 in 1 hour.

### 4. QA script
A short manual-QA script the team runs before flipping the flag for general availability:
1. Sign in as a new test workspace.
2. Connect a GitHub repo to a project.
3. Add a non-prod environment with a target URL.
4. Run a scan via the wizard; verify authorization step works.
5. Wait for completion (~30 min in staging — use the test container target).
6. Verify findings render correctly in en + ar + fr + de + es.
7. Download PDF report.
8. Cancel a scan; verify status flips and billing reflects partial.
9. Resume a cancelled scan; verify it picks up at the right phase.
10. Disable the flag; verify the sidebar item disappears + `/recon` returns 404.

### Tests
- N/A — operator documentation. The actual testable behaviors are covered in F1–F6.

### i18n
- N/A — internal docs are English only (project convention; verify against existing internal runbooks).

### Documentation
- This prompt IS the operator documentation.

### Files to modify
- `docs/internal/recon-rollout.md`
- `docs/internal/recon-runbook.md`
- Dashboard JSON / alert rule files (location depends on project's monitoring stack).

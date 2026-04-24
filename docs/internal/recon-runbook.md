# Recon — On-Call Runbook

Internal operator doc. Paired with [`recon-rollout.md`](./recon-rollout.md). Binding rules live in `.claude/rules/recon-safety.md`.

Page the recon-engineer on-call for anything in § Failure modes. For cost or abuse issues, loop in billing on-call as well.

---

## Quick links

- Kill switch: `UPDATE feature_flags SET rollout_percent = 0 WHERE key = 'recon_enabled';` (instant; returns 404 globally per rule #7).
- Service logs: `make logs-recon-executor`, `make logs-gateway`.
- Executor health: `GET /health` on the `recon-executor` service.
- Gateway Prometheus metrics: `GET /metrics` (auth required; see `ARCHITECTURE.md` § 1259).

---

## Architecture in one paragraph

A scan starts when the gateway accepts `POST /api/recon/scans`, writes a row to `recon_scans` + `recon_scan_authorizations`, and enqueues it. The `recon-executor` service (Python, FastAPI) picks it up, runs phases 1–5 (fingerprinting → discovery → vulnerability analysis → exploitation → reporting), writes phase progress to `recon_scan_phases`, findings to `recon_findings`, and the final report to `recon_reports`. A heartbeat loop updates `recon_scans.last_heartbeat_at`; if that stalls for > 5 min the watchdog flips status to `stuck`.

---

## Failure modes

### 1. Scan stuck (no heartbeat > 5 min)

**Symptom**
- `recon_scans.status = 'stuck'` for one or more rows.
- UI shows the stuck banner on the scan detail page.
- Dashboard alert `recon_scans_stuck_count > 5` over 1h may fire.

**Diagnose**

```bash
# Which scans are stuck?
make psql
```

```sql
SELECT id, workspace_id, status, current_phase,
       last_heartbeat_at, now() - last_heartbeat_at AS staleness
FROM recon_scans
WHERE status = 'stuck'
ORDER BY last_heartbeat_at DESC;
```

Then look at the executor logs for the offending scan id:

```bash
make logs-recon-executor | grep <scan_id>
```

Check whether the LLM provider is responsive. If the phase log stopped at `vulnerability_analysis` or `exploitation`, the LLM call likely hung.

**Mitigate**
1. First, try a user-driven resume: instruct the user to click **Resume** on the scan detail page, or call `POST /api/recon/scans/:id/resume`. The endpoint enforces URL equality (rule #5) — resume won't accept a drifted URL.
2. If the executor pod itself is wedged (no heartbeats for any scan): `kubectl rollout restart deployment/recon-executor -n <env>`. Pending scans will pick up on the next poll.
3. If the stuck scan count is climbing despite restarts, flip the kill switch and investigate offline.

---

### 2. Cost overrun / PAYG spike

**Symptom**
- PAYG dashboard shows > $200 workspace spend in any 1-hour window.
- Alert `recon_payg_spike` fires.

**Diagnose**

```sql
-- Top spenders in the last hour.
SELECT workspace_id, count(*) AS scans, sum(cost_credits) AS credits
FROM recon_scans
WHERE created_at > now() - interval '1 hour'
GROUP BY workspace_id
ORDER BY credits DESC
LIMIT 10;

-- Runaway hypothesis counts on the offending scan.
SELECT scan_id, count(*) AS findings
FROM recon_findings
WHERE scan_id IN (SELECT id FROM recon_scans WHERE workspace_id = :ws_id)
GROUP BY scan_id
ORDER BY findings DESC
LIMIT 10;
```

**Mitigate**
- Lower the workspace's `recon_monthly_scans` quota in `recon_workspace_settings`.
- Or flip the per-workspace flag off (see § Targeted per-workspace disable).
- For a genuine exploit-pipeline runaway (findings count growing without bound), escalate to recon-engineer. Do **not** attempt to retry failed exploits — rule #2 forbids auto-retry of write-class exploits.

---

### 3. Exploit produced unexpected target mutation

**Symptom**
- Customer reports unexpected data changes on their target after a scan.

**Diagnose**

```sql
-- Confirm authorization audit row was present (rule #1).
SELECT a.*
FROM recon_scan_authorizations a
JOIN recon_scans s ON s.id = a.scan_id
WHERE s.workspace_id = :ws_id
ORDER BY a.created_at DESC
LIMIT 10;

-- Pull exploitation artifacts for the scan.
SELECT id, phase, kind, created_at
FROM recon_scan_artifacts
WHERE scan_id = :scan_id AND phase = 'exploitation'
ORDER BY created_at;
```

Inspect the exploitation-phase log in the executor for the payload class and target endpoint.

**Mitigate**
- Confirm the authorization audit row exists. If it does not, this is a P0 — rule #1 was bypassed. File an incident.
- Advise the customer that authorization-only white-box pentesting can mutate state (see customer docs under `docs/en/recon/responsible-use.md`). No v1 hard-block (rule #9); this is expected behavior.
- If a specific vuln class repeatedly causes issues, propose tightening its per-class rate limits in the next sprint. Do not ship a silent rate-limit change during an incident.

---

### 4. LLM provider outage

**Symptom**
- Phase 3 (`vulnerability_analysis`) or phase 4 (`exploitation`) fails with `recon_scans.error_message LIKE '%LLM unavailable%'` or `'%rate limit%'`.

**Diagnose**

```sql
SELECT id, workspace_id, current_phase, error_message, created_at
FROM recon_scans
WHERE status = 'failed' AND error_message ILIKE '%llm%'
ORDER BY created_at DESC
LIMIT 20;
```

**Mitigate**
- The AI provider factory (commit `7ca5f41`) already retries and falls back to the secondary provider. If both providers are down, scans will fail legitimately. Post to the public status page and stop new scan intake by flipping `rollout_percent = 0` until recovery.
- Do not manually retry failed scans from the shell — users can re-initiate from the UI once providers recover.

---

### 5. Scanned repo content triggered prompt injection

**Symptom**
- LLM output in finding descriptions contains out-of-character text, instructions to the user, or content that looks copied from the target repo rather than generated by the analyzer.

**Diagnose**

```bash
# Confirm the prompt-injection wrapper is being applied (see A4 / rule #4).
make logs-recon-executor | grep -E '<repo_file path=' | head
```

If the wrapper tags are absent from logged prompts, the hardening has regressed.

**Mitigate**
- If the wrapper is present: record the offending scan id, quarantine the finding (mark it internal-only), and file a product bug to tune the system prompt.
- If the wrapper is absent: this is a P0. File an incident, flip the kill switch (`rollout_percent = 0`), and page recon-engineer. Do not re-enable until rule #4 is verified in the executor code path and covered by a regression test.

---

### 6. Production-environment scan complaints

**Symptom**
- Customer complains a scan hit their production environment unexpectedly.

**Diagnose**

```sql
-- Confirm the env was tagged `production`.
SELECT s.id, s.target_url, e.name, e.environment_type
FROM recon_scans s
JOIN environments e ON e.id = s.environment_id
WHERE s.id = :scan_id;
```

Verify the UI warning was shown — this should have been surfaced both in the wizard and on the detail page (rule #9).

**Mitigate**
- Remind the customer that v1 does not hard-block production scans; the warning is advisory. Link to the responsible-use doc.
- If multiple complaints accumulate, consider prioritizing a hard-block prompt in the next sprint.

---

## Monitoring & alerts

The project uses Prometheus-style metrics exposed at `/metrics` (see `ARCHITECTURE.md` §§ 430, 1259). Full Grafana/OpenTelemetry wiring is pending — until then, operate from the dashboards and saved queries below.

### Dashboards (panels)

| Panel | Source | What it shows |
|-------|--------|---------------|
| Recon scans / hour | `recon_scans.created_at` | Volume |
| Recon scans by status | `recon_scans.status` (stacked: running, completed, failed, cancelled, stuck) | Health mix |
| Avg scan duration by phase | `recon_scan_phases.started_at, finished_at` | Phase bottlenecks |
| Avg cost per scan (credits) | `recon_scans.cost_credits` | Cost envelope |
| LLM error rate during Recon | gateway metric tagged `source=recon` | Provider health |
| Per-workspace scan count (top 10) | `recon_scans` group by `workspace_id` | Abuse / top users |

Starter SQL for each panel lives next to this file when the dashboard is codified. Until then, use the ad-hoc queries in § Failure modes.

### Alerts

| Name | Condition | Severity | Action |
|------|-----------|----------|--------|
| `recon_executor_unhealthy` | `GET /health` on `recon-executor` failing for > 5 min | P1 | Runbook § 1 |
| `recon_scans_stuck_count` | > 5 stuck scans over 1h | P2 | Runbook § 1 |
| `recon_scan_failure_rate` | failure rate > 30% over 1h | P2 | Runbook §§ 4, 5 |
| `recon_payg_spike` | any workspace > $200 PAYG charges in 1h | P2 | Runbook § 2 |

Alert rule files live alongside the project's existing monitoring config. If alerts have not yet been codified for the current stack, treat the dashboards as the sole signal and page manually from the Recon scans-by-status panel. Track the wiring as a follow-up — do not let the rollout proceed to 100% without alerts in place.

---

## Common tasks

### Targeted per-workspace disable

```sql
INSERT INTO organization_feature_flags (organization_id, flag_key, enabled)
VALUES (:workspace_id, 'recon_enabled', false)
ON CONFLICT (organization_id, flag_key) DO UPDATE SET enabled = false;
```

### Global kill switch

```sql
UPDATE feature_flags SET rollout_percent = 0 WHERE key = 'recon_enabled';
```

Gateway returns 404 immediately (rule #7). Frontend sidebar entry disappears on next navigation. In-flight scans continue; scale the executor to zero replicas if you must hard-stop them.

### Inspect a scan's full trail

```sql
SELECT * FROM recon_scans               WHERE id = :scan_id;
SELECT * FROM recon_scan_authorizations WHERE scan_id = :scan_id;
SELECT * FROM recon_scan_phases         WHERE scan_id = :scan_id ORDER BY started_at;
SELECT * FROM recon_findings            WHERE scan_id = :scan_id;
SELECT id, phase, kind, created_at FROM recon_scan_artifacts WHERE scan_id = :scan_id ORDER BY created_at;
SELECT * FROM recon_reports             WHERE scan_id = :scan_id;
```

### Confirm no write-class retries happened

```sql
-- Exploits with class='write' should appear at most once per scan (rule #2).
SELECT scan_id, finding_id, count(*) AS attempts
FROM recon_scan_artifacts
WHERE phase = 'exploitation' AND kind LIKE 'exploit_write_%'
GROUP BY scan_id, finding_id
HAVING count(*) > 1;
-- Expect zero rows.
```

### Verify PoC reproducibility on a report

```sql
-- Any finding that reached a report MUST have a non-null PoC (rule #10).
SELECT f.id
FROM recon_findings f
JOIN recon_reports r ON r.scan_id = f.scan_id
WHERE (f.proof_of_concept IS NULL OR f.proof_of_concept = '');
-- Expect zero rows.
```

---

## Escalation

- **P0 — rule violation** (missing authorization row, missing prompt-injection wrapper, write-exploit retry): flip the kill switch, page recon-engineer, file an incident.
- **P1 — service outage** (executor unhealthy, LLM providers both down): flip the kill switch, page recon-engineer, post to the status page.
- **P2 — degradation** (stuck scans, elevated failure rate, cost spikes): investigate per the matching § Failure modes section; only flip the kill switch if the situation worsens.

When in doubt, prefer flipping the flag. It is instant, reversible, and safe — and a quiet feature is always better than a misbehaving one.

# Recon — Post-Merge Rollout Checklist

Internal operator doc. Not customer-facing. Read `.claude/rules/recon-safety.md` before executing any step here.

Partner document: [`recon-runbook.md`](./recon-runbook.md) — on-call procedures.

---

## 0. Scope

This checklist covers the first production rollout of the Recon feature. It assumes all code is merged to `main`. The gate is the single `recon_enabled` feature flag (see `.claude/rules/recon-safety.md` rule #7).

Owner: recon-engineer on-call.

---

## 1. Pre-merge checks

CI on the merge commit must be fully green. Do not proceed if any of the following are red:

- [ ] `prompts/06-recon/F1-backend-unit-tests.md` — gateway unit tests (auth, resume, multi-tenancy, flag behavior).
- [ ] `prompts/06-recon/F2-executor-integration-tests.md` — recon-executor integration tests (payload redaction, prompt-injection wrapper, no-retry on write-class exploits).
- [ ] `prompts/06-recon/F3-frontend-component-tests.md` — frontend component tests (wizard, detail page, production-env warning).
- [ ] `prompts/06-recon/F4-e2e-scan-flow.md` — end-to-end scan flow.
- [ ] `prompts/06-recon/F5-billing-and-flag-tests.md` — billing + flag interaction.
- [ ] `prompts/06-recon/F6-i18n-coverage-tests.md` — i18n coverage across en/ar/fr/de/es + banned-vocabulary grep.

Run these locally to double-check before cutting the release:

```bash
make test-gateway
make test-frontend
make test-recon-integration

# Banned-vocabulary grep — must return zero matches (rule #6).
grep -r -i 'shannon\|nmap\|subfinder\|whatweb\|schemathesis\|playwright\|anthropic\|claude' \
  frontend/public/locales \
  gateway/src/i18n/translations \
  frontend/src/components/landing \
  docs/recon
```

---

## 2. Database migration

Migrations 051–053 add the Recon schema. Run in staging first, verify, then production.

### 2.1 Apply

Migrations are applied by the database container on boot. For staging:

```bash
# Staging: bring the DB container up and let entrypoint apply pending migrations.
make start
make logs-db | grep -E "05[1-3]_recon"
```

### 2.2 Verify schema

Connect and confirm all new objects exist.

```bash
make psql
```

```sql
-- Migration 051_recon_tables.sql — 6 new tables.
\dt recon_scans
\dt recon_scan_phases
\dt recon_findings
\dt recon_reports
\dt recon_scan_artifacts
\dt recon_scan_authorizations

-- Migration 052_recon_ai_config.sql — 3 new billing_config rows (model tier overrides).
SELECT key, value FROM billing_config WHERE key LIKE 'recon_%_model';
-- Expect: recon_small_model, recon_medium_model, recon_large_model (values may be '' — inherit default).

-- Migration 053_recon_workspace_settings.sql — 1 new table.
\dt recon_workspace_settings

-- Feature flag row must exist and default to OFF.
SELECT key, enabled, rollout_percent FROM feature_flags WHERE key = 'recon_enabled';
-- Expect: enabled=false, rollout_percent=0 at first rollout.
```

If any table is missing, stop. Do not continue the rollout. File an incident and investigate the migration log.

### 2.3 Index health

After migration, confirm no long-running locks or bloat:

```sql
SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE relname LIKE 'recon_%' ORDER BY relname;
```

---

## 3. Service rollout

Deploy in this order. Do NOT deploy gateway before recon-executor — the gateway will start accepting scan requests it can't dispatch.

### 3.1 Bring up `recon-executor`

```bash
# Staging
kubectl rollout restart deployment/recon-executor -n staging
kubectl rollout status  deployment/recon-executor -n staging --timeout=5m

# Smoke-test the health endpoint.
kubectl exec -n staging deploy/recon-executor -- curl -s http://localhost:8000/health
# Expect: JSON body with status "ok" and endpoints.health = "/health".
```

Also check the scheduled-job workers inside the executor are live:

```bash
make logs-recon-executor | grep -E "orchestrator|heartbeat_loop"
```

### 3.2 Deploy gateway

```bash
kubectl rollout restart deployment/gateway -n staging
kubectl rollout status  deployment/gateway -n staging --timeout=5m

# Smoke-test: endpoints must return 404 while the flag is still off (rule #7).
curl -s -o /dev/null -w "%{http_code}\n" https://staging.api.example.com/api/recon/scans
# Expect: 404
```

### 3.3 Deploy frontend

```bash
kubectl rollout restart deployment/frontend -n staging
kubectl rollout status  deployment/frontend -n staging --timeout=5m

# Smoke-test: /recon route returns 404 while flag is off.
curl -s -o /dev/null -w "%{http_code}\n" https://staging.example.com/recon
# Expect: 404 (or a generic 404 page from the SPA).
```

---

## 4. Flag enablement (staged rollout)

The `recon_enabled` flag controls the entire feature. Flip it in stages.

### Stage A — internal test workspace

Enable only for the internal Acme test workspace:

```sql
-- Replace :workspace_id with the Acme test workspace UUID.
INSERT INTO organization_feature_flags (organization_id, flag_key, enabled)
VALUES (:workspace_id, 'recon_enabled', true)
ON CONFLICT (organization_id, flag_key) DO UPDATE SET enabled = true;
```

Then run the full [QA script](#9-qa-script-gate-for-general-availability) as an Acme operator, using the canary staging target. All steps must pass before proceeding.

### Stage B — 10% rollout

```sql
UPDATE feature_flags SET enabled = true, rollout_percent = 10 WHERE key = 'recon_enabled';
```

Watch the dashboards for **24 hours**. Abort if:

- `recon_scan_failure_rate` > 30% over any 1-hour window.
- `recon_scans_stuck_count` > 5 over any 1-hour window.
- Any P0/P1 incident filed against Recon.

### Stage C — 50% rollout

```sql
UPDATE feature_flags SET rollout_percent = 50 WHERE key = 'recon_enabled';
```

Same abort criteria. Hold for **24 hours**.

### Stage D — 100%

```sql
UPDATE feature_flags SET rollout_percent = 100 WHERE key = 'recon_enabled';
```

Rollout complete. Announce on the internal status channel. Leave the flag in `rollout_percent = 100` (do not remove the flag — it remains the kill switch).

---

## 5. Monitoring

Dashboards and alerts are documented in the runbook: [`recon-runbook.md` § Monitoring](./recon-runbook.md#monitoring--alerts). Confirm each panel is populating data before starting Stage B.

---

## 6. Rollback plan

The Recon feature has a **single kill switch**. Rollback is instant (no redeploy needed):

```sql
UPDATE feature_flags SET rollout_percent = 0 WHERE key = 'recon_enabled';
```

Effect (per `.claude/rules/recon-safety.md` rule #7):

- Gateway `/api/recon/*` returns `404` cleanly.
- Frontend sidebar entry disappears; `/recon` route returns 404.
- In-flight scans continue to completion (the executor does not read the flag mid-scan). To hard-stop in-flight scans, also:

```bash
kubectl scale deployment/recon-executor --replicas=0 -n <env>
```

Scans will be marked `stuck` by the heartbeat watchdog and the user can resume them once the executor is scaled back up.

### 6.1 Targeted per-workspace rollback

If only one workspace is misbehaving (e.g., cost overrun), keep the global flag on and disable just that workspace:

```sql
INSERT INTO organization_feature_flags (organization_id, flag_key, enabled)
VALUES (:workspace_id, 'recon_enabled', false)
ON CONFLICT (organization_id, flag_key) DO UPDATE SET enabled = false;
```

### 6.2 Schema rollback

Do not roll back migrations 051–053. The tables are additive and holding scan history; dropping them destroys audit data that may be required for billing reconciliation.

---

## 7. Post-rollout follow-ups

- [ ] Confirm billing reconciliation ran (check `recon_scans.status='completed'` rows have matching usage events).
- [ ] Confirm at least one end-to-end scan completed in production with a non-null `proof_of_concept` on every reported finding (rule #10).
- [ ] Archive this rollout's dashboards snapshot for the retro.
- [ ] Update `ARCHITECTURE.md` if anything in the executor or gateway surface changed during rollout.

---

## 8. Known constraints (carry into v1 ops)

- **No hard block on production-environment scans.** The UI warns, but does not block (rule #9). Expect occasional customer questions about data mutation.
- **Failed write-class exploits are never retried** (rule #2). Expect some findings with `status='failed_exploit'`; these do not retry automatically.
- **Prompt-injection hardening is mandatory.** Every repo file ingested by the executor is wrapped per rule #4. If a regression removes the wrapper, that's a P0.
- **Single feature flag.** No per-phase or per-vuln-class flags (rule #7). Do not add new gates without an architecture review.

---

## 9. QA script (gate for general availability)

Run this manually as an Acme operator before advancing to Stage B (10% rollout).

1. Sign in as a newly created test workspace.
2. Connect a GitHub repo to a project.
3. Add a non-prod environment with a target URL (the canary target container).
4. Launch a scan via the new-scan wizard. Confirm the authorization step is required and persists a row in `recon_scan_authorizations` (rule #1).
5. Wait for completion (~30 min against the canary target in staging).
6. Verify findings render correctly in en + ar + fr + de + es. Check RTL layout in Arabic.
7. Download the PDF report. Confirm every finding has a non-null, reproducible `proof_of_concept` (rule #10).
8. Cancel a scan mid-run. Verify `recon_scans.status` flips to `cancelled` and billing reflects the partial usage.
9. Resume a cancelled scan. Verify it picks up at the right phase and rejects any URL mismatch (rule #5).
10. Set `rollout_percent = 0` on `recon_enabled`. Verify the sidebar entry disappears and `/recon` returns 404. Re-enable before proceeding.

If any step fails, do not advance the rollout.

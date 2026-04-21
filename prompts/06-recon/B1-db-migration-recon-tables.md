# Recon — DB migration: scans, phases, findings, reports, artifacts, authorizations

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/pentest-orchestration/` (A3), `.claude/skills/finding-severity/` (A5), `.claude/skills/exploit-safety/` (A4)
- Supporting: `.claude/skills/whynot-dashboard/`
- Rules: `.claude/rules/recon-safety.md` (A7), `.claude/rules/spec-driven-development.md`

## Dependencies
- A1, A3, A4, A5, A7

## Task
Create migration `051_recon_tables.sql` and the corresponding raw-SQL repositories.

### 1. Migration file
- Create: `services/database/migrations/051_recon_tables.sql`
- Confirm `050_*.sql` is the highest existing migration; if a higher number was added between planning and execution, use the next free integer and update all cross-references.

### 2. Tables to create

```sql
-- recon_scans: top-level scan record
CREATE TABLE recon_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE RESTRICT,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed','cancelled','stuck')),
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancel_requested_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  config_yaml TEXT,
  error_message TEXT,
  total_cost_credits BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recon_scans_workspace_status ON recon_scans(workspace_id, status);
CREATE INDEX idx_recon_scans_project ON recon_scans(project_id);

-- recon_scan_phases: per-phase checkpoint
CREATE TABLE recon_scan_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES recon_scans(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('fingerprinting','discovery','vuln_analysis','exploitation','reporting')),
  status TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed','skipped','cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  output_artifact_id UUID,
  error_message TEXT,
  UNIQUE (scan_id, phase)
);

-- recon_findings: validated + discarded findings
CREATE TABLE recon_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES recon_scans(id) ON DELETE CASCADE,
  vuln_class TEXT NOT NULL CHECK (vuln_class IN ('injection','xss','ssrf','auth','authz')),
  status TEXT NOT NULL CHECK (status IN ('confirmed','discarded_unprovable','false_positive')),
  severity TEXT CHECK (severity IN ('low','medium','high','critical')),
  impact_score SMALLINT,
  exploitability_score SMALLINT,
  blast_radius_score SMALLINT,
  normalized_endpoint TEXT,
  normalized_param TEXT,
  description TEXT NOT NULL,
  proof_of_concept JSONB,           -- discriminated union: {kind, language, content} or {kind:'http', request, response}
  exploit_outcome TEXT,
  remediation TEXT,
  duplicates JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recon_findings_scan_severity ON recon_findings(scan_id, severity);
CREATE UNIQUE INDEX uq_recon_findings_dedup
  ON recon_findings(scan_id, vuln_class, normalized_endpoint, normalized_param)
  WHERE status = 'confirmed';

-- recon_reports: consolidated final report
CREATE TABLE recon_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL UNIQUE REFERENCES recon_scans(id) ON DELETE CASCADE,
  markdown TEXT NOT NULL,
  pdf_url TEXT,
  summary JSONB NOT NULL,           -- {total, by_severity, by_class}
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- recon_scan_artifacts: phase outputs (recon maps, raw scan data, screenshots)
CREATE TABLE recon_scan_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES recon_scans(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  kind TEXT NOT NULL,               -- 'json', 'text', 'image', 'pdf'
  storage_url TEXT NOT NULL,        -- internal blob store URL (workspace-scoped)
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- recon_scan_authorizations: per-scan legal authorization audit log (immutable)
CREATE TABLE recon_scan_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL UNIQUE REFERENCES recon_scans(id) ON DELETE CASCADE,
  acknowledged_by_user_id UUID NOT NULL REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ NOT NULL,
  justification TEXT NOT NULL CHECK (length(justification) BETWEEN 20 AND 1000),
  caller_ip INET NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3. Repositories
Create in `shared/database/repositories/`:
- `recon-scan-repository.ts` (CRUD + status transitions + heartbeat update + cancel-request)
- `recon-finding-repository.ts` (insert with dedup UPSERT, list-by-scan with filters)
- `recon-report-repository.ts` (get/insert by scan_id)
- `recon-scan-phase-repository.ts` (checkpoint helper)
- `recon-scan-artifact-repository.ts` (insert/list)
- `recon-scan-authorization-repository.ts` (insert + get by scan_id; no update method — immutable)

Mirror the style of `shared/database/repositories/test-case-repository.ts`. Every method takes a `query` function and returns typed rows.

### 4. Updated_at trigger
Add the standard `updated_at` trigger to `recon_scans` matching the pattern used by other tables in the project (find existing trigger function with `\df` or grep migrations).

### Tests
- Migration up/down tested via `make shell-database psql` — verify all CHECK constraints reject bad values.
- Repository unit tests in `shared/database/repositories/__tests__/`:
  - Insert + read round-trip per repository
  - Dedup UPSERT keeps highest-severity row
  - Wrong-workspace query returns empty (multi-tenancy)
  - Authorization repository rejects updates (no method exposed; raw SQL UPDATE attempt should fail at the type-check level)
  - Cascade delete when scan is removed
- 100% line coverage on new repository files.

### i18n
- No user-facing strings in this prompt directly. Repositories return raw rows; i18n happens at the API layer (C6).

### Documentation
- N/A — internal data model.

### Files to modify
- Create: `services/database/migrations/051_recon_tables.sql`
- Create: 6 repository files in `shared/database/repositories/`
- Create: corresponding `__tests__/` files

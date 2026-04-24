-- Migration 051: Recon scans, phases, findings, reports, artifacts, authorizations
--
-- Adds the data model for the authorization-only Recon feature:
--   * recon_scans                  top-level scan record
--   * recon_scan_phases            per-phase checkpoint
--   * recon_findings               validated + discarded findings
--   * recon_reports                consolidated final report
--   * recon_scan_artifacts         phase outputs (maps, raw scan data, screenshots)
--   * recon_scan_authorizations    per-scan legal authorization audit log (immutable)
--
-- Note: this migration references `saved_environments(id)` rather than an
-- `environments` table — the project has never had an `environments` table;
-- `saved_environments` is the canonical environment record (see migration 020).

BEGIN;

-- ─── recon_scans ─────────────────────────────────────────────────────
CREATE TABLE recon_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES saved_environments(id) ON DELETE RESTRICT,
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

CREATE TRIGGER recon_scans_updated_at
  BEFORE UPDATE ON recon_scans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── recon_scan_phases ───────────────────────────────────────────────
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

-- ─── recon_findings ──────────────────────────────────────────────────
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
  proof_of_concept JSONB,
  exploit_outcome TEXT,
  remediation TEXT,
  duplicates JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recon_findings_scan_severity ON recon_findings(scan_id, severity);

-- Dedup index: only one confirmed finding per (scan, class, endpoint, param).
-- Discarded / false-positive rows are excluded so multiple may coexist.
CREATE UNIQUE INDEX uq_recon_findings_dedup
  ON recon_findings(scan_id, vuln_class, normalized_endpoint, normalized_param)
  WHERE status = 'confirmed';

-- ─── recon_reports ───────────────────────────────────────────────────
CREATE TABLE recon_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL UNIQUE REFERENCES recon_scans(id) ON DELETE CASCADE,
  markdown TEXT NOT NULL,
  pdf_url TEXT,
  summary JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── recon_scan_artifacts ────────────────────────────────────────────
CREATE TABLE recon_scan_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES recon_scans(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  kind TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recon_scan_artifacts_scan_phase ON recon_scan_artifacts(scan_id, phase);

-- ─── recon_scan_authorizations ───────────────────────────────────────
-- Immutable legal authorization audit log. The application layer must
-- never expose an UPDATE method on this table (rule 1 of recon-safety).
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

COMMIT;

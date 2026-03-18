-- Migration 025: QA Monitors — Scheduled recurring QA scans
-- Allows users to set up recurring QA scans on a cron schedule

CREATE TABLE IF NOT EXISTS qa_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  target_url TEXT NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  quality_threshold INTEGER DEFAULT 80,
  max_iterations INTEGER DEFAULT 5,
  is_enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_session_id UUID REFERENCES qa_loop_sessions(id) ON DELETE SET NULL,
  last_quality_score INTEGER,
  last_status VARCHAR(20) CHECK (last_status IS NULL OR last_status IN ('pass', 'fail', 'running', 'error')),
  consecutive_failures INTEGER DEFAULT 0,
  notify_on_failure BOOLEAN DEFAULT true,
  notify_on_regression BOOLEAN DEFAULT true,
  login_credentials JSONB,
  document_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_monitors_workspace ON qa_monitors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_qa_monitors_next_run ON qa_monitors(next_run_at) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_qa_monitors_enabled ON qa_monitors(is_enabled, next_run_at);

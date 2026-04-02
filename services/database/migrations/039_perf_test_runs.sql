-- Performance test runs table
CREATE TABLE IF NOT EXISTS perf_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  test_type VARCHAR(20) NOT NULL, -- smoke, load, stress, spike
  target_url TEXT NOT NULL,
  method VARCHAR(10) DEFAULT 'POST',
  config JSONB NOT NULL, -- full k6 config (stages, thresholds, headers, body, additionalRequests)
  status VARCHAR(20) DEFAULT 'running', -- running, completed, failed, stopped
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  -- Summary metrics
  total_requests INTEGER,
  failed_requests INTEGER,
  avg_response_time_ms FLOAT,
  p50_response_time_ms FLOAT,
  p90_response_time_ms FLOAT,
  p95_response_time_ms FLOAT,
  p99_response_time_ms FLOAT,
  max_response_time_ms FLOAT,
  min_response_time_ms FLOAT,
  requests_per_second FLOAT,
  -- Full k6 output
  raw_metrics JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_perf_test_runs_project ON perf_test_runs(project_id);
CREATE INDEX idx_perf_test_runs_workspace ON perf_test_runs(workspace_id);
CREATE INDEX idx_perf_test_runs_status ON perf_test_runs(status);

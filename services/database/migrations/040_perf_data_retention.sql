-- Add index for data retention queries (cleanup runs older than 90 days)
CREATE INDEX IF NOT EXISTS idx_perf_test_runs_created_at
  ON perf_test_runs(created_at);

-- Function to clean up old perf test runs (call periodically via cron or app logic)
CREATE OR REPLACE FUNCTION cleanup_old_perf_runs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM perf_test_runs
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    AND status != 'running';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

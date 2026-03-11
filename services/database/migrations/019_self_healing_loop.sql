-- Migration: 019_self_healing_loop.sql
-- Description: Self-healing test loop — Claude observed result + mismatch tracking

-- Claude's observed result when generating the test
ALTER TABLE qa_loop_test_cases
  ADD COLUMN IF NOT EXISTS observed_result VARCHAR(20) DEFAULT NULL;

-- Track mismatch details on test runs
ALTER TABLE qa_loop_test_runs
  ADD COLUMN IF NOT EXISTS observed_result VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_mismatch BOOLEAN DEFAULT false;

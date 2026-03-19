-- Migration 032: Add confidence scoring columns to qa_loop_test_cases
-- Tracks pass/fail history to compute a confidence score per test case

ALTER TABLE qa_loop_test_cases
  ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_runs INTEGER DEFAULT 0;

-- pass_count already exists (added in migration 031 or earlier via updateTestCaseLastRun).
-- Add it defensively in case it doesn't exist yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qa_loop_test_cases' AND column_name = 'pass_count'
  ) THEN
    ALTER TABLE qa_loop_test_cases ADD COLUMN pass_count INTEGER DEFAULT 0;
  END IF;
END $$;

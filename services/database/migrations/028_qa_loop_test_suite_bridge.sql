-- Migration: 028_qa_loop_test_suite_bridge.sql
-- Description: Bridge QA Loop results into the project/test-suite hierarchy.
--   After a QA session completes, a test suite is auto-created under the project.
--   QA-generated test cases and bugs link back to that suite.

-- 1. Link QA sessions to auto-created test suites
ALTER TABLE qa_loop_sessions
  ADD COLUMN IF NOT EXISTS test_suite_id UUID REFERENCES test_suites(id) ON DELETE SET NULL;

-- 2. Link QA-generated test cases to standard test cases (when promoted)
ALTER TABLE qa_loop_test_cases
  ADD COLUMN IF NOT EXISTS test_suite_id UUID REFERENCES test_suites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS standard_test_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL;

-- 3. Link QA bugs to the test case that discovered them
--    regression_test_id already exists but let's add an explicit discovered_by column
ALTER TABLE qa_loop_bugs
  ADD COLUMN IF NOT EXISTS discovered_by_test_case_id UUID REFERENCES qa_loop_test_cases(id) ON DELETE SET NULL;

-- 4. Indexes for the new foreign keys
CREATE INDEX IF NOT EXISTS idx_qa_loop_sessions_test_suite ON qa_loop_sessions(test_suite_id);
CREATE INDEX IF NOT EXISTS idx_qa_loop_test_cases_test_suite ON qa_loop_test_cases(test_suite_id);
CREATE INDEX IF NOT EXISTS idx_qa_loop_test_cases_standard ON qa_loop_test_cases(standard_test_case_id);
CREATE INDEX IF NOT EXISTS idx_qa_loop_bugs_discovered_by ON qa_loop_bugs(discovered_by_test_case_id);

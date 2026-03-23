-- Migration 035: Add feature_category column to test case tables for grouping by feature area
ALTER TABLE qa_loop_test_cases ADD COLUMN IF NOT EXISTS feature_category VARCHAR(100) DEFAULT 'General';
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS feature_category VARCHAR(100) DEFAULT 'General';
ALTER TABLE qa_loop_test_cases ADD COLUMN IF NOT EXISTS requires_auth BOOLEAN DEFAULT false;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS requires_auth BOOLEAN DEFAULT false;

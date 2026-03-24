-- Migration 036: Add project_id to test_suites for direct project linking
ALTER TABLE test_suites ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_test_suites_project_id ON test_suites(project_id);

-- Backfill: set project_id from user_stories link
UPDATE test_suites ts
SET project_id = us.project_id
FROM user_stories us
WHERE ts.user_story_id = us.id
AND ts.project_id IS NULL;

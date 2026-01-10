-- Setup Hooks Migration
-- Adds support for setup hooks that run before test execution
-- Supports global, suite/folder, and test case level hooks

-- Setup hooks table
CREATE TABLE IF NOT EXISTS setup_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  level VARCHAR(50) NOT NULL CHECK (level IN ('global', 'suite', 'test_case')),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES user_story_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  -- Ensure level-specific constraints
  CONSTRAINT setup_hooks_level_constraint CHECK (
    (level = 'global' AND test_case_id IS NULL AND folder_id IS NULL) OR
    (level = 'suite' AND folder_id IS NOT NULL AND test_case_id IS NULL) OR
    (level = 'test_case' AND test_case_id IS NOT NULL AND folder_id IS NULL)
  )
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_setup_hooks_level ON setup_hooks(level);
CREATE INDEX IF NOT EXISTS idx_setup_hooks_enabled ON setup_hooks(enabled);
CREATE INDEX IF NOT EXISTS idx_setup_hooks_test_case_id ON setup_hooks(test_case_id);
CREATE INDEX IF NOT EXISTS idx_setup_hooks_folder_id ON setup_hooks(folder_id);
CREATE INDEX IF NOT EXISTS idx_setup_hooks_created_at ON setup_hooks(created_at);

-- Function to update updated_at timestamp for setup_hooks
CREATE OR REPLACE FUNCTION update_setup_hooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_setup_hooks_updated_at ON setup_hooks;
CREATE TRIGGER update_setup_hooks_updated_at 
  BEFORE UPDATE ON setup_hooks
  FOR EACH ROW EXECUTE FUNCTION update_setup_hooks_updated_at();







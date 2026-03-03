-- Migration 018: Create workspaces table and add workspace_id to all core data tables

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

-- Seed a "Default" workspace for existing (pre-auth) data
INSERT INTO workspaces (id, name, owner_id)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default', NULL)
ON CONFLICT (id) DO NOTHING;

-- Add workspace_id to all core data tables (nullable; existing rows default to the legacy workspace)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)
  DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)
  DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE executions
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)
  DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE qa_loop_sessions
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)
  DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE user_stories
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)
  DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE user_story_folders
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)
  DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE setup_hooks
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)
  DEFAULT '00000000-0000-0000-0000-000000000000';

-- Indexes for fast workspace-scoped queries
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_workspace ON test_cases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_executions_workspace ON executions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_qa_loop_sessions_workspace ON qa_loop_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_stories_workspace ON user_stories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_story_folders_workspace ON user_story_folders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_setup_hooks_workspace ON setup_hooks(workspace_id);

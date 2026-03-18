-- User Story Folders Migration
-- Adds support for organizing user stories into folders within projects

-- Folders table for grouping user stories
CREATE TABLE IF NOT EXISTS user_story_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) DEFAULT '#0284c7',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add folder_id to user_stories table
ALTER TABLE user_stories 
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES user_story_folders(id) ON DELETE SET NULL;

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_story_folders_project_id ON user_story_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_user_story_folders_created_at ON user_story_folders(created_at);
CREATE INDEX IF NOT EXISTS idx_user_stories_folder_id ON user_stories(folder_id);

-- Function to update updated_at timestamp for folders
CREATE OR REPLACE FUNCTION update_user_story_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_story_folders_updated_at ON user_story_folders;
CREATE TRIGGER update_user_story_folders_updated_at 
  BEFORE UPDATE ON user_story_folders
  FOR EACH ROW EXECUTE FUNCTION update_user_story_folders_updated_at();







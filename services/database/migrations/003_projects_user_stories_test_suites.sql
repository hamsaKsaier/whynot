-- Projects, User Stories, and Test Suites Migration
-- Adds support for hierarchical organization of test artifacts

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  website_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Stories table
CREATE TABLE IF NOT EXISTS user_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  story TEXT NOT NULL,
  website_url VARCHAR(500),
  additional_context TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Test Suites table
CREATE TABLE IF NOT EXISTS test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_story_id UUID REFERENCES user_stories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Update test_cases table to add foreign keys
ALTER TABLE test_cases 
  ADD COLUMN IF NOT EXISTS test_suite_id UUID REFERENCES test_suites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_story_id UUID REFERENCES user_stories(id) ON DELETE SET NULL;

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_user_stories_project_id ON user_stories(project_id);
CREATE INDEX IF NOT EXISTS idx_user_stories_created_at ON user_stories(created_at);
CREATE INDEX IF NOT EXISTS idx_test_suites_user_story_id ON test_suites(user_story_id);
CREATE INDEX IF NOT EXISTS idx_test_suites_created_at ON test_suites(created_at);
CREATE INDEX IF NOT EXISTS idx_test_cases_test_suite_id ON test_cases(test_suite_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_user_story_id ON test_cases(user_story_id);

-- Function to update updated_at timestamp for projects
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update updated_at timestamp for user_stories
CREATE OR REPLACE FUNCTION update_user_stories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update updated_at timestamp for test_suites
CREATE OR REPLACE FUNCTION update_test_suites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_projects_updated_at();

CREATE TRIGGER update_user_stories_updated_at BEFORE UPDATE ON user_stories
    FOR EACH ROW EXECUTE FUNCTION update_user_stories_updated_at();

CREATE TRIGGER update_test_suites_updated_at BEFORE UPDATE ON test_suites
    FOR EACH ROW EXECUTE FUNCTION update_test_suites_updated_at();

-- Migration: Create a default project and extract user stories from existing test cases
-- This helps with backward compatibility
DO $$
DECLARE
  default_project_id UUID;
  test_case_record RECORD;
  user_story_id UUID;
  user_story_hash TEXT;
  existing_user_story_id UUID;
BEGIN
  -- Create a default project
  INSERT INTO projects (name, description)
  VALUES ('Default Project', 'Auto-created from existing test cases')
  ON CONFLICT DO NOTHING
  RETURNING id INTO default_project_id;
  
  -- If no default project exists, get it
  IF default_project_id IS NULL THEN
    SELECT id INTO default_project_id FROM projects WHERE name = 'Default Project' LIMIT 1;
  END IF;
  
  -- Extract unique user stories from test_cases and create user_stories entries
  FOR test_case_record IN 
    SELECT DISTINCT ON (user_story, website_url) 
      id, user_story, website_url
    FROM test_cases
    WHERE user_story IS NOT NULL AND user_story != ''
  LOOP
    -- Check if user story already exists
    SELECT id INTO existing_user_story_id
    FROM user_stories
    WHERE story = test_case_record.user_story 
      AND (website_url = test_case_record.website_url OR (website_url IS NULL AND test_case_record.website_url IS NULL))
      AND project_id = default_project_id
    LIMIT 1;
    
    -- Create user story if it doesn't exist
    IF existing_user_story_id IS NULL THEN
      INSERT INTO user_stories (project_id, story, website_url)
      VALUES (default_project_id, test_case_record.user_story, test_case_record.website_url)
      RETURNING id INTO user_story_id;
    ELSE
      user_story_id := existing_user_story_id;
    END IF;
    
    -- Update test cases to reference the user story
    UPDATE test_cases
    SET user_story_id = user_story_id
    WHERE user_story = test_case_record.user_story 
      AND (website_url = test_case_record.website_url OR (website_url IS NULL AND test_case_record.website_url IS NULL))
      AND user_story_id IS NULL;
  END LOOP;
END $$;









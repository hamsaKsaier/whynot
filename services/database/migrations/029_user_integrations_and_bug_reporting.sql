-- Migration: 029_user_integrations_and_bug_reporting.sql
-- Description: Add user-level integrations table for ClickUp/GitHub bug reporting,
--   and add reporting fields to qa_loop_bugs.

-- 1. User-level integrations (ClickUp tokens, GitHub config per user)
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,               -- 'clickup' | 'github'
  encrypted_token TEXT,                        -- AES-256-CBC encrypted API token (ClickUp)
  config JSONB DEFAULT '{}'::jsonb,            -- workspace_id, list_id, repo owner/name, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One integration per provider per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_integrations_user_provider
  ON user_integrations (user_id, provider);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id
  ON user_integrations (user_id);

-- 2. Add bug reporting fields to qa_loop_bugs
ALTER TABLE qa_loop_bugs
  ADD COLUMN IF NOT EXISTS reported_to VARCHAR(50),      -- 'clickup' | 'github'
  ADD COLUMN IF NOT EXISTS external_url TEXT,             -- URL to the created task/issue
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMP WITH TIME ZONE;

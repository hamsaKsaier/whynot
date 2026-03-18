-- Migration: 020_saved_environments.sql
-- Description: Creates table for saved test environments (persistent URLs for QA Loop)

CREATE TABLE IF NOT EXISTS saved_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_environments_workspace ON saved_environments(workspace_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER saved_environments_updated_at
    BEFORE UPDATE ON saved_environments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

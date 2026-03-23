-- Migration 034: Add project context (knowledge base) and user PRD fields
-- Supports the Project Context killer feature — persistent knowledge across QA sessions

ALTER TABLE projects ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_prd TEXT DEFAULT '';

-- Index for faster context queries
CREATE INDEX IF NOT EXISTS idx_projects_context_gin ON projects USING gin (context);

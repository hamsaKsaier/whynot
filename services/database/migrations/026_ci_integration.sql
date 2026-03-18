-- Migration 026: CI Integration API Keys
-- API keys for CI/CD pipeline integrations (GitHub Actions, GitLab CI, etc.)

CREATE TABLE IF NOT EXISTS ci_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL,  -- First 8 chars for display (e.g., "wn_ci_ab")
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_api_keys_workspace ON ci_api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ci_api_keys_hash ON ci_api_keys(key_hash) WHERE is_active = true;

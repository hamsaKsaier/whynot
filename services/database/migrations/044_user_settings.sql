-- Migration 044: User settings tables and columns
-- Adds: preferred_language, deleted_at on users; user_api_keys table;
--        data_export_requests table; workspace_invitations table.

-- 1. Add preferred_language and deleted_at to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;

-- 2. User API keys (hashed at rest, plaintext never stored)
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  key_salt VARCHAR(64) NOT NULL,
  last_four VARCHAR(4) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NULL,
  revoked_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_key_hash ON user_api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys (user_id) WHERE revoked_at IS NULL;

-- 3. Data export requests
CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format VARCHAR(10) NOT NULL DEFAULT 'json',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  download_url TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_user_id ON data_export_requests (user_id);

-- 4. Workspace invitations
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON workspace_invitations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invitations_unique_pending
  ON workspace_invitations (workspace_id, email) WHERE status = 'pending';

-- 5. Add trigger_types for new notification categories (product_updates, billing, security)
-- The notification_preferences table already exists from migration 030.
-- New trigger_type values will be inserted on first use via upsert.

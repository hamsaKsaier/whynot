-- Migration 053: Per-workspace Recon settings
--
-- Stores workspace-level Recon configuration managed by the owner:
--   * notify_recipient_user_ids  user IDs to email on scan complete / fail
--   * email_on_complete          bool: send scan-complete emails
--   * email_on_fail              bool: send scan-failed emails
--   * payg_cap_credits           max credits per scan. 0 = no cap (platform default)
--
-- One row per workspace. Workspace owner maintains this via PUT /api/recon/settings.

BEGIN;

CREATE TABLE IF NOT EXISTS recon_workspace_settings (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  notify_recipient_user_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  email_on_complete BOOLEAN NOT NULL DEFAULT TRUE,
  email_on_fail BOOLEAN NOT NULL DEFAULT TRUE,
  payg_cap_credits INTEGER NOT NULL DEFAULT 0 CHECK (payg_cap_credits >= 0 AND payg_cap_credits <= 100000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

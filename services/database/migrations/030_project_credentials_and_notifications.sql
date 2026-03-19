-- 030_project_credentials_and_notifications.sql
-- Adds project_credentials table for storing encrypted test credentials
-- and notification_preferences table for per-user email notification settings.

-- ── Project Credentials ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL,
  encrypted_username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_credentials_project_id
  ON project_credentials (project_id);

-- Each project has at most one set of credentials
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_credentials_unique_project
  ON project_credentials (project_id);

-- ── Notification Preferences ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('scan_complete', 'critical_bug', 'monitor_alert', 'autofix_pr')),
  channel         TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
  ON notification_preferences (user_id);

-- Each user has one preference row per trigger_type + channel combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_unique
  ON notification_preferences (user_id, trigger_type, channel);

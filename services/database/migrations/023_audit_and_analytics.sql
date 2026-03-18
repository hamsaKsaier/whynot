-- Migration 023: Audit log, system settings, and announcements
-- These tables support Phase 6 advanced admin features.

-- Audit log for tracking all admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- System settings (key-value store for admin-configurable settings)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO system_settings (key, value, description) VALUES
  ('default_plan_slug', 'free-trial', 'Default plan assigned to new users on registration'),
  ('signup_enabled', 'true', 'Whether new user registration is enabled'),
  ('maintenance_mode', 'false', 'Enable maintenance mode to block non-admin access'),
  ('credit_cost.test_generation', '3', 'Credit cost for test generation'),
  ('credit_cost.test_execution', '1', 'Credit cost for test execution'),
  ('credit_cost.qa_loop_iteration', '2', 'Credit cost per QA Loop iteration'),
  ('credit_cost.qa_loop_session_reserve', '10', 'Credit cost reserved when starting a QA Loop session'),
  ('credit_cost.visual_regression', '1', 'Credit cost for visual regression comparison'),
  ('credit_cost.chaos_test', '3', 'Credit cost per chaos test iteration')
ON CONFLICT (key) DO NOTHING;

-- Announcements for user-facing banners
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  body TEXT,
  type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, starts_at, ends_at);

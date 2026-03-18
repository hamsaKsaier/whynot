-- Migration: 021_admin_role_and_plans.sql
-- Description: Adds admin role to users, creates plans, subscriptions, and credit system tables

-- ─── User Role ───────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Add CHECK constraint (safe with IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('user', 'admin', 'super_admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ─── Plans ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  billing_interval VARCHAR(20) DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly', 'yearly', 'one_time')),
  credits_per_period INTEGER NOT NULL DEFAULT 0,
  trial_days INTEGER DEFAULT 0,
  is_custom BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  stripe_price_id VARCHAR(255),
  stripe_product_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_public ON plans(is_public, is_archived);

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── Plan Features (dynamic key-value feature flags per plan) ────────────────

CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  feature_value VARCHAR(255) DEFAULT 'true',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_plan_features_plan ON plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_key ON plan_features(feature_key);

-- ─── Workspace Subscriptions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspace_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status VARCHAR(30) DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'paused', 'incomplete')),
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  canceled_at TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_ws_subs_workspace ON workspace_subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_subs_plan ON workspace_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_ws_subs_stripe ON workspace_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_ws_subs_status ON workspace_subscriptions(status);

CREATE TRIGGER ws_subs_updated_at
  BEFORE UPDATE ON workspace_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── Credit Balances ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_credits_purchased INTEGER DEFAULT 0,
  lifetime_credits_used INTEGER DEFAULT 0,
  lifetime_credits_granted INTEGER DEFAULT 0,
  last_refill_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_balances_workspace ON credit_balances(workspace_id);

CREATE TRIGGER credit_balances_updated_at
  BEFORE UPDATE ON credit_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── Credit Transactions (immutable ledger) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  type VARCHAR(30) NOT NULL
    CHECK (type IN ('subscription_refill', 'purchase', 'usage', 'refund', 'admin_grant', 'admin_revoke', 'rollover', 'expiry')),
  description TEXT,
  reference_type VARCHAR(50),
  reference_id VARCHAR(255),
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_txns_workspace ON credit_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_credit_txns_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_txns_created ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_txns_ref ON credit_transactions(reference_type, reference_id);

-- ─── Seed Default Plans ──────────────────────────────────────────────────────

INSERT INTO plans (name, slug, description, price_cents, credits_per_period, trial_days, is_custom, sort_order)
VALUES
  ('Free Trial', 'free-trial', 'Get started with 100 credits for 14 days', 0, 100, 14, false, 1),
  ('Starter', 'starter', '500 credits/month for small teams', 2900, 500, 0, false, 2),
  ('Pro', 'pro', '2500 credits/month for growing teams', 9900, 2500, 0, false, 3),
  ('Enterprise', 'enterprise', 'Custom credits and dedicated support', 0, 0, 0, true, 4)
ON CONFLICT (slug) DO NOTHING;

-- ─── Seed Plan Features ──────────────────────────────────────────────────────

-- Free Trial features
INSERT INTO plan_features (plan_id, feature_key, feature_value)
SELECT p.id, f.key, f.val
FROM plans p
CROSS JOIN (VALUES
  ('max_projects', '1'),
  ('max_workspace_members', '1'),
  ('qa_loop', 'true'),
  ('visual_regression', 'false'),
  ('chaos_testing', 'false'),
  ('webhooks', 'false'),
  ('api_access', 'false'),
  ('max_concurrent_sessions', '1'),
  ('execution_history_days', '7'),
  ('priority_support', 'false')
) AS f(key, val)
WHERE p.slug = 'free-trial'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Starter features
INSERT INTO plan_features (plan_id, feature_key, feature_value)
SELECT p.id, f.key, f.val
FROM plans p
CROSS JOIN (VALUES
  ('max_projects', '3'),
  ('max_workspace_members', '3'),
  ('qa_loop', 'true'),
  ('visual_regression', 'true'),
  ('chaos_testing', 'false'),
  ('webhooks', 'true'),
  ('max_webhooks', '1'),
  ('api_access', 'false'),
  ('max_concurrent_sessions', '2'),
  ('execution_history_days', '30'),
  ('priority_support', 'false')
) AS f(key, val)
WHERE p.slug = 'starter'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Pro features
INSERT INTO plan_features (plan_id, feature_key, feature_value)
SELECT p.id, f.key, f.val
FROM plans p
CROSS JOIN (VALUES
  ('max_projects', '15'),
  ('max_workspace_members', '10'),
  ('qa_loop', 'true'),
  ('visual_regression', 'true'),
  ('chaos_testing', 'true'),
  ('webhooks', 'true'),
  ('max_webhooks', '5'),
  ('api_access', 'true'),
  ('max_concurrent_sessions', '5'),
  ('execution_history_days', '90'),
  ('priority_support', 'true')
) AS f(key, val)
WHERE p.slug = 'pro'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Enterprise features
INSERT INTO plan_features (plan_id, feature_key, feature_value)
SELECT p.id, f.key, f.val
FROM plans p
CROSS JOIN (VALUES
  ('max_projects', '-1'),
  ('max_workspace_members', '-1'),
  ('qa_loop', 'true'),
  ('visual_regression', 'true'),
  ('chaos_testing', 'true'),
  ('webhooks', 'true'),
  ('max_webhooks', '-1'),
  ('api_access', 'true'),
  ('max_concurrent_sessions', '-1'),
  ('execution_history_days', '365'),
  ('priority_support', 'true')
) AS f(key, val)
WHERE p.slug = 'enterprise'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

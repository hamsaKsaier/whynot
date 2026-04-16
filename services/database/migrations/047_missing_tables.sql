-- Migration 047: Create missing tables referenced by repository layer
-- Tables: billing_config, billing_history, payg_credits_ledger,
--         payment_transactions, integrations, bug_tasks, user_ai_config

BEGIN;

-- ─── billing_config ─────────────────────────────────────────────────
-- Key-value store for billing configuration (trial days, PAYG rates, etc.)
CREATE TABLE IF NOT EXISTS billing_config (
  key   TEXT        PRIMARY KEY,
  value TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults
INSERT INTO billing_config (key, value) VALUES
  ('trial_days',    '14'),
  ('currency',      'usd'),
  ('payg_enabled',  'false'),
  ('payg_rate_ai_call_cents',       '2'),
  ('payg_rate_test_run_cents',      '5'),
  ('payg_rate_visual_diff_cents',   '1')
ON CONFLICT (key) DO NOTHING;

-- ─── billing_history ────────────────────────────────────────────────
-- Immutable audit log for billing/payment events
CREATE TABLE IF NOT EXISTS billing_history (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID        NOT NULL,
  event_type        VARCHAR(100) NOT NULL,
  provider          VARCHAR(50)  NOT NULL,
  provider_event_id VARCHAR(255),
  amount_cents      BIGINT,
  currency          VARCHAR(10)  NOT NULL DEFAULT 'usd',
  metadata          JSONB,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_history_workspace
  ON billing_history (workspace_id, created_at DESC);

-- ─── payg_credits_ledger ────────────────────────────────────────────
-- Pay-as-you-go credit transaction ledger
CREATE TABLE IF NOT EXISTS payg_credits_ledger (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              UUID        NOT NULL,
  amount_cents              BIGINT      NOT NULL,
  reason                    TEXT        NOT NULL,
  related_event_id          VARCHAR(255),
  stripe_payment_intent_id  VARCHAR(255),
  status                    VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'completed', 'failed')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payg_ledger_workspace
  ON payg_credits_ledger (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payg_ledger_status
  ON payg_credits_ledger (workspace_id, status);

-- ─── payment_transactions ───────────────────────────────────────────
-- Individual payment attempt tracking
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID         NOT NULL,
  provider                VARCHAR(50)  NOT NULL,
  provider_transaction_id VARCHAR(255) NOT NULL,
  type                    VARCHAR(20)  NOT NULL
                          CHECK (type IN ('subscription', 'one_time', 'refund', 'payg')),
  status                  VARCHAR(20)  NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('completed', 'failed', 'pending')),
  amount_cents            BIGINT       NOT NULL,
  currency                VARCHAR(10)  NOT NULL DEFAULT 'usd',
  failure_code            VARCHAR(100),
  failure_message         TEXT,
  idempotency_key         VARCHAR(255),
  metadata                JSONB,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_workspace
  ON payment_transactions (workspace_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_tx_idempotency
  ON payment_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ─── integrations ───────────────────────────────────────────────────
-- Workspace integrations (Jira, ClickUp, Linear)
CREATE TABLE IF NOT EXISTS integrations (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID         NOT NULL,
  type          VARCHAR(20)  NOT NULL CHECK (type IN ('jira', 'clickup', 'linear')),
  name          VARCHAR(200) NOT NULL,
  config        JSONB        NOT NULL DEFAULT '{}',
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_workspace
  ON integrations (workspace_id);

-- ─── bug_tasks ──────────────────────────────────────────────────────
-- Links QA bugs to external issue tracker tasks
CREATE TABLE IF NOT EXISTS bug_tasks (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id          UUID         NOT NULL,
  integration_id  UUID         NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  external_id     VARCHAR(255) NOT NULL,
  external_url    TEXT,
  status          VARCHAR(50)  NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bug_tasks_bug
  ON bug_tasks (bug_id);

CREATE INDEX IF NOT EXISTS idx_bug_tasks_integration
  ON bug_tasks (integration_id);

-- ─── user_ai_config ─────────────────────────────────────────────────
-- User-specific AI provider configurations (encrypted API keys)
CREATE TABLE IF NOT EXISTS user_ai_config (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID    NOT NULL,
  provider           VARCHAR(50)  NOT NULL,
  model              VARCHAR(100) NOT NULL,
  base_url           TEXT,
  api_key_encrypted  BYTEA   NOT NULL,
  api_key_iv         BYTEA   NOT NULL,
  api_key_tag        BYTEA   NOT NULL,
  is_default         BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_ai_config_user
  ON user_ai_config (user_id);

COMMIT;

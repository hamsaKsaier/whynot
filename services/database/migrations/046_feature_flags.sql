-- 046_feature_flags.sql
-- Feature flag registry + per-workspace overrides.
-- Referenced by shared/database/repositories/feature-flag-repository.ts
-- and gateway/src/utils/feature-flags.ts.

CREATE TABLE IF NOT EXISTS feature_flags (
  key              text    PRIMARY KEY,
  name             text    NOT NULL,
  description      text,
  default_enabled  boolean NOT NULL DEFAULT false,
  rollout_percent  integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_feature_flags (
  organization_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  flag_key         text        NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
  enabled          boolean     NOT NULL,
  set_by           uuid        REFERENCES users(id),
  set_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_org_feature_flags_org ON organization_feature_flags(organization_id);

-- Seed the registry keys the application knows about. Matches
-- shared/constants/platform-features.ts and shared/database/seeds/feature-flags.ts.
INSERT INTO feature_flags (key, name, description, default_enabled) VALUES
  ('ai_multi_provider',        'AI Multi-Provider',       'Allow switching between AI providers (OpenAI, Anthropic, etc.)', false),
  ('payg_billing',             'Pay-As-You-Go Billing',   'Enable pay-as-you-go billing for metered usage',                 false),
  ('landing_lead_capture',     'Landing Lead Capture',    'Show lead capture forms on landing pages',                       false),
  ('advanced_analytics',       'Advanced Analytics',      'Enable advanced analytics dashboards and exports',               false),
  ('superadmin_impersonation', 'Superadmin Impersonation','Allow superadmins to impersonate organization users',            false),
  ('language_switcher',        'Language Switcher',       'Show the language switcher in the UI',                           true)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at  = now();

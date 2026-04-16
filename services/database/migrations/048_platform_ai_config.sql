-- Migration 048: Platform-level AI provider configuration
-- Stores admin-managed API keys with AES-256-GCM encryption,
-- default model configuration, and fallback provider ordering.

BEGIN;

-- ─── platform_ai_config ────────────────────────────────────────────
-- Platform-level (super-admin managed) AI provider configurations
CREATE TABLE IF NOT EXISTS platform_ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  api_key_encrypted BYTEA,
  api_key_iv BYTEA,
  api_key_tag BYTEA,
  fallback_key_encrypted BYTEA,
  fallback_key_iv BYTEA,
  fallback_key_tag BYTEA,
  default_model VARCHAR(100),
  models JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT false,
  rate_limit INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider)
);

CREATE INDEX IF NOT EXISTS idx_platform_ai_config_provider
  ON platform_ai_config(provider);

CREATE INDEX IF NOT EXISTS idx_platform_ai_config_active
  ON platform_ai_config(is_active);

-- Seed the 4 known providers (inactive, no keys)
INSERT INTO platform_ai_config (provider, display_name, default_model, models, is_active) VALUES
  ('openai', 'OpenAI', 'gpt-4o', '["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini", "o3-mini"]'::jsonb, false),
  ('anthropic', 'Anthropic', 'claude-sonnet-4-6', '["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-3-5-sonnet-20241022"]'::jsonb, false),
  ('google', 'Google AI', 'gemini-2.0-flash', '["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"]'::jsonb, false),
  ('openrouter', 'OpenRouter', 'anthropic/claude-sonnet-4', '["anthropic/claude-sonnet-4", "openai/gpt-4o", "google/gemini-2.0-flash-001", "meta-llama/llama-3.1-405b-instruct"]'::jsonb, false)
ON CONFLICT (provider) DO NOTHING;

-- ─── billing_config seeds for AI defaults ───────────────────────────
INSERT INTO billing_config (key, value) VALUES
  ('default_ai_provider', '{"provider": "anthropic", "model": "claude-sonnet-4-6"}'),
  ('ai_fallback_order', '["anthropic", "openai", "google", "openrouter"]')
ON CONFLICT (key) DO NOTHING;

COMMIT;

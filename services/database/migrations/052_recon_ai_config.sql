-- Migration 052: Recon-specific AI model tier overrides
-- Lets ops dial up the "large" tier for Recon without affecting QA-loop costs.
-- Empty/missing value means "inherit the platform-wide default for that tier."

BEGIN;

INSERT INTO billing_config (key, value) VALUES
  ('recon_small_model',  ''),
  ('recon_medium_model', ''),
  ('recon_large_model',  '')
ON CONFLICT (key) DO NOTHING;

COMMIT;

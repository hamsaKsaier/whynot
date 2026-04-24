-- Migration 054: reconcile plan taxonomy with architectural design
--
-- Background: the repo has two plan taxonomies that never converged.
--   * Legacy DB set (migration 021): free-trial, starter, pro, enterprise
--   * Architectural set (shared/constants/pricing.ts, ARCHITECTURE.md, recon spec B3):
--     free, pro_byo, pro_managed
--
-- Recon features (seeded against the architectural set) never landed on any
-- real plan row, so `requireFeature('recon_enabled')` 403s for every paying
-- customer. PAYG also never fires on legacy `pro` because
-- `SubscriptionManager.isManagedPaygTier('pro')` returns false (slug not in
-- PLANS constant).
--
-- This migration:
--   1. Adds `tier` to `plans` so isManagedPaygTier works for any plan row.
--   2. Inserts the architectural plans (free, pro_byo, pro_managed) with
--      stripe_price_id NULL (ops backfills via Stripe sync).
--   3. Sets tier on legacy plans so grandfathered subscribers keep working:
--      - free-trial, starter → byo_keys
--      - pro, enterprise     → managed_payg (existing paid customers already
--                              signed up for the platform-managed experience)
--   4. Marks legacy plans is_public=false so new signups can't pick them,
--      but keeps is_archived=false so existing workspace_subscriptions stay
--      valid. No workspace_subscriptions rows are mutated by this migration.
--   5. Carries non-recon plan_features forward from legacy → architectural
--      rows so new signups inherit sensible defaults.
--
-- Post-migration, `shared/database/seeds/plan-features.ts:seedReconPlanFeatures`
-- (called at gateway startup) populates recon_enabled + recon_monthly_scans
-- on every plan row the DB actually contains.

BEGIN;

ALTER TABLE plans ADD COLUMN IF NOT EXISTS tier VARCHAR(32);

-- Insert architectural plans. ON CONFLICT keeps this idempotent; if ops has
-- already created them out-of-band, those rows are preserved untouched.
INSERT INTO plans (
  name, slug, tier, description, price_cents, credits_per_period,
  trial_days, is_public, is_archived, is_custom, sort_order
) VALUES
  ('Free',                 'free',        'byo_keys',     'Bring your own AI keys',        0,  100, 14, true, false, false, 1),
  ('Pro (BYO Keys)',       'pro_byo',     'byo_keys',     'Bring your own AI keys',     2900, 2500,  0, true, false, false, 2),
  ('Pro (Managed + PAYG)', 'pro_managed', 'managed_payg', 'Managed keys, pay-as-you-go', 4900, 2500,  0, true, false, false, 3)
ON CONFLICT (slug) DO NOTHING;

-- Tier legacy plans (only if unset — don't overwrite an operator override).
UPDATE plans SET tier = 'byo_keys'
 WHERE slug IN ('free-trial', 'starter')     AND tier IS NULL;

UPDATE plans SET tier = 'managed_payg'
 WHERE slug IN ('pro', 'enterprise')          AND tier IS NULL;

-- Hide legacy plans from new signups. Existing subscriptions continue.
UPDATE plans SET is_public = false
 WHERE slug IN ('free-trial', 'starter', 'pro', 'enterprise');

-- Carry non-recon features forward onto the architectural plans so new
-- signups get sensible entitlements inherited from the corresponding legacy
-- tier. free-trial → free; starter → pro_byo; pro → pro_managed.
INSERT INTO plan_features (plan_id, feature_key, feature_value)
SELECT dst.id, pf.feature_key, pf.feature_value
FROM plan_features pf
JOIN plans src ON src.id = pf.plan_id
JOIN plans dst ON dst.slug = CASE src.slug
  WHEN 'free-trial' THEN 'free'
  WHEN 'starter'    THEN 'pro_byo'
  WHEN 'pro'        THEN 'pro_managed'
END
WHERE src.slug IN ('free-trial', 'starter', 'pro')
ON CONFLICT (plan_id, feature_key) DO NOTHING;

COMMIT;

import { query } from '../connection';
import { RECON_PLAN_FEATURES_BY_SLUG } from '../../constants/pricing';

const RECON_ENABLED_KEY = 'recon_enabled';
const RECON_MONTHLY_SCANS_KEY = 'recon_monthly_scans';

async function upsertFeatureBySlug(slug: string, key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO plan_features (plan_id, feature_key, feature_value)
     SELECT p.id, $2, $3
     FROM plans p
     WHERE p.slug = $1
     ON CONFLICT (plan_id, feature_key) DO UPDATE SET feature_value = EXCLUDED.feature_value`,
    [slug, key, value],
  );
}

// Seeds recon_enabled + recon_monthly_scans for every plan slug present in
// RECON_PLAN_FEATURES_BY_SLUG. Iterating the map (not VALID_PLAN_SLUGS) means
// legacy DB plans grandfathered by migration 054 also receive recon
// entitlements, so active customers get recon without a subscription-data
// migration. Plan rows that don't exist in the DB are silently skipped by
// the INSERT ... SELECT ... WHERE p.slug = $1 pattern.
export async function seedReconPlanFeatures(): Promise<void> {
  for (const [slug, defaults] of Object.entries(RECON_PLAN_FEATURES_BY_SLUG)) {
    await upsertFeatureBySlug(slug, RECON_ENABLED_KEY, defaults.recon_enabled ? 'true' : 'false');
    await upsertFeatureBySlug(slug, RECON_MONTHLY_SCANS_KEY, String(defaults.recon_monthly_scans));
  }
}

export { RECON_ENABLED_KEY, RECON_MONTHLY_SCANS_KEY };

import { query } from '../connection';
import {
  DEFAULT_RECON_PLAN_FEATURES,
  VALID_PLAN_SLUGS,
  type PlanSlug,
} from '../../constants/pricing';

const RECON_ENABLED_KEY = 'recon_enabled';
const RECON_MONTHLY_SCANS_KEY = 'recon_monthly_scans';

async function upsertFeatureBySlug(slug: PlanSlug, key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO plan_features (plan_id, feature_key, feature_value)
     SELECT p.id, $2, $3
     FROM plans p
     WHERE p.slug = $1
     ON CONFLICT (plan_id, feature_key) DO UPDATE SET feature_value = EXCLUDED.feature_value`,
    [slug, key, value],
  );
}

export async function seedReconPlanFeatures(): Promise<void> {
  for (const slug of VALID_PLAN_SLUGS) {
    const defaults = DEFAULT_RECON_PLAN_FEATURES[slug];
    await upsertFeatureBySlug(slug, RECON_ENABLED_KEY, defaults.recon_enabled ? 'true' : 'false');
    await upsertFeatureBySlug(slug, RECON_MONTHLY_SCANS_KEY, String(defaults.recon_monthly_scans));
  }
}

export { RECON_ENABLED_KEY, RECON_MONTHLY_SCANS_KEY };

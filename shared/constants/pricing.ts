export type PlanTier = 'byo_keys' | 'managed_payg';

export interface PlanDefinition {
  name: string;
  monthlyCents: bigint;
  tier: PlanTier;
}

export const PLANS = {
  free: { name: 'Free', monthlyCents: 0n, tier: 'byo_keys' as const },
  pro_byo: { name: 'Pro (Bring Your Own Keys)', monthlyCents: 2900n, tier: 'byo_keys' as const },
  pro_managed: { name: 'Pro (Managed + PAYG)', monthlyCents: 4900n, tier: 'managed_payg' as const },
} as const;

export type PlanSlug = keyof typeof PLANS;

export const VALID_PLAN_SLUGS = Object.keys(PLANS) as PlanSlug[];

export function isPlanSlug(value: string): value is PlanSlug {
  return value in PLANS;
}

export function getPlanDefinition(slug: PlanSlug): PlanDefinition {
  return PLANS[slug];
}

export const DEFAULT_TRIAL_DAYS = 14;

export const DEFAULT_PAYG_RATES: Record<string, bigint> = {
  test_generation: 50n,
  test_execution: 10n,
  qa_loop_iteration: 30n,
  auto_fix_attempt: 100n,
  visual_regression: 15n,
  qa_monitor_session: 200n,
  ci_scan: 200n,
  recon_scan_run: 5000n,
  recon_phase_fingerprinting: 200n,
  recon_phase_discovery: 800n,
  recon_phase_vuln_analysis: 1500n,
  recon_phase_exploitation: 2000n,
  recon_phase_reporting: 500n,
};

export const RECON_PAYG_EVENT_TYPES = [
  'recon_scan_run',
  'recon_phase_fingerprinting',
  'recon_phase_discovery',
  'recon_phase_vuln_analysis',
  'recon_phase_exploitation',
  'recon_phase_reporting',
] as const;

export type ReconPaygEventType = (typeof RECON_PAYG_EVENT_TYPES)[number];

export interface ReconPlanFeatures {
  recon_enabled: boolean;
  recon_monthly_scans: number;
}

// Recon entitlement per plan slug. Keyed on a string (not PlanSlug) because
// the DB retains legacy plan slugs (free-trial, starter, pro, enterprise)
// after migration 054 as grandfathered options — existing subscriptions keep
// their original plan_id while new signups get the architectural slugs
// (free, pro_byo, pro_managed). The seeder iterates this map so every DB
// plan row, old or new, receives the correct recon entitlement.
export const RECON_PLAN_FEATURES_BY_SLUG: Record<string, ReconPlanFeatures> = {
  // Architectural (post-054 canonical)
  free:         { recon_enabled: false, recon_monthly_scans: 0 },
  pro_byo:      { recon_enabled: true,  recon_monthly_scans: 1 },
  pro_managed:  { recon_enabled: true,  recon_monthly_scans: 3 },
  // Legacy (pre-054; grandfathered; kept in lockstep with their architectural
  // counterparts so active customers get recon without a subscription-data
  // migration).
  'free-trial': { recon_enabled: false, recon_monthly_scans: 0 },
  starter:      { recon_enabled: true,  recon_monthly_scans: 1 },
  pro:          { recon_enabled: true,  recon_monthly_scans: 3 },
  enterprise:   { recon_enabled: true,  recon_monthly_scans: 99 },
};

// Strictly-typed projection for callers that expect only architectural slugs.
export const DEFAULT_RECON_PLAN_FEATURES: Record<PlanSlug, ReconPlanFeatures> =
  VALID_PLAN_SLUGS.reduce((acc, slug) => {
    acc[slug] = RECON_PLAN_FEATURES_BY_SLUG[slug];
    return acc;
  }, {} as Record<PlanSlug, ReconPlanFeatures>);

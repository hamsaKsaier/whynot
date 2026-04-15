export const PLATFORM_FEATURES = {
  AI_MULTI_PROVIDER: 'ai_multi_provider',
  PAYG_BILLING: 'payg_billing',
  LANDING_LEAD_CAPTURE: 'landing_lead_capture',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  SUPERADMIN_IMPERSONATION: 'superadmin_impersonation',
  LANGUAGE_SWITCHER: 'language_switcher',
} as const;

export type PlatformFeatureKey = (typeof PLATFORM_FEATURES)[keyof typeof PLATFORM_FEATURES];

export const ALL_PLATFORM_FEATURE_KEYS: PlatformFeatureKey[] = Object.values(PLATFORM_FEATURES);

export function isValidFeatureKey(key: string): key is PlatformFeatureKey {
  return (ALL_PLATFORM_FEATURE_KEYS as string[]).includes(key);
}

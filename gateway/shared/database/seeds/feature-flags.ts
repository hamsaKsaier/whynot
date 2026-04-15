import { query } from '../connection';
import { PLATFORM_FEATURES } from '../../constants/platform-features';

interface FeatureFlagSeed {
  key: string;
  name: string;
  description: string;
  default_enabled: boolean;
}

const FLAG_SEEDS: FeatureFlagSeed[] = [
  {
    key: PLATFORM_FEATURES.AI_MULTI_PROVIDER,
    name: 'AI Multi-Provider',
    description: 'Allow switching between AI providers (OpenAI, Anthropic, etc.)',
    default_enabled: false,
  },
  {
    key: PLATFORM_FEATURES.PAYG_BILLING,
    name: 'Pay-As-You-Go Billing',
    description: 'Enable pay-as-you-go billing for metered usage',
    default_enabled: false,
  },
  {
    key: PLATFORM_FEATURES.LANDING_LEAD_CAPTURE,
    name: 'Landing Lead Capture',
    description: 'Show lead capture forms on landing pages',
    default_enabled: false,
  },
  {
    key: PLATFORM_FEATURES.ADVANCED_ANALYTICS,
    name: 'Advanced Analytics',
    description: 'Enable advanced analytics dashboards and exports',
    default_enabled: false,
  },
  {
    key: PLATFORM_FEATURES.SUPERADMIN_IMPERSONATION,
    name: 'Superadmin Impersonation',
    description: 'Allow superadmins to impersonate organization users',
    default_enabled: false,
  },
  {
    key: PLATFORM_FEATURES.LANGUAGE_SWITCHER,
    name: 'Language Switcher',
    description: 'Show the language switcher in the UI',
    default_enabled: true,
  },
];

export async function seedFeatureFlags(): Promise<void> {
  for (const flag of FLAG_SEEDS) {
    await query(
      `INSERT INTO feature_flags (key, name, description, default_enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description`,
      [flag.key, flag.name, flag.description, flag.default_enabled]
    );
  }
}

export { FLAG_SEEDS };

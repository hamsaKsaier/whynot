import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../database/connection', () => ({
  query: vi.fn().mockResolvedValue([]),
}));

describe('feature-flags seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FLAG_SEEDS contains all 7 platform features', async () => {
    const { FLAG_SEEDS } = await import('../database/seeds/feature-flags');
    expect(FLAG_SEEDS).toHaveLength(7);
    const keys = FLAG_SEEDS.map((f) => f.key);
    expect(keys).toContain('ai_multi_provider');
    expect(keys).toContain('payg_billing');
    expect(keys).toContain('landing_lead_capture');
    expect(keys).toContain('advanced_analytics');
    expect(keys).toContain('superadmin_impersonation');
    expect(keys).toContain('language_switcher');
    expect(keys).toContain('recon_enabled');
  });

  it('only LANGUAGE_SWITCHER is enabled by default', async () => {
    const { FLAG_SEEDS } = await import('../database/seeds/feature-flags');
    const enabled = FLAG_SEEDS.filter((f) => f.default_enabled).map((f) => f.key).sort();
    expect(enabled).toEqual(['language_switcher']);
  });

  it('each seed has required fields', async () => {
    const { FLAG_SEEDS } = await import('../database/seeds/feature-flags');
    for (const flag of FLAG_SEEDS) {
      expect(flag.key).toBeTruthy();
      expect(flag.name).toBeTruthy();
      expect(flag.description).toBeTruthy();
      expect(typeof flag.default_enabled).toBe('boolean');
    }
  });

  it('seedFeatureFlags calls query for each flag', async () => {
    const { query } = await import('../database/connection');
    const { seedFeatureFlags, FLAG_SEEDS } = await import('../database/seeds/feature-flags');
    await seedFeatureFlags();
    expect(query).toHaveBeenCalledTimes(FLAG_SEEDS.length);
  });

  it('seedFeatureFlags uses upsert SQL', async () => {
    const { query } = await import('../database/connection');
    const { seedFeatureFlags } = await import('../database/seeds/feature-flags');
    await seedFeatureFlags();
    const sql = (query as any).mock.calls[0][0];
    expect(sql).toContain('INSERT INTO feature_flags');
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO UPDATE');
  });

  it('seedFeatureFlags passes correct params', async () => {
    const { query } = await import('../database/connection');
    const { seedFeatureFlags, FLAG_SEEDS } = await import('../database/seeds/feature-flags');
    await seedFeatureFlags();
    const firstCall = (query as any).mock.calls[0];
    expect(firstCall[1]).toEqual([
      FLAG_SEEDS[0].key,
      FLAG_SEEDS[0].name,
      FLAG_SEEDS[0].description,
      FLAG_SEEDS[0].default_enabled,
    ]);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PLATFORM_FEATURES, isValidFeatureKey } from '../constants/platform-features';

vi.mock('../database/connection', () => ({
  query: vi.fn().mockResolvedValue([]),
}));

describe('recon_enabled feature flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PLATFORM_FEATURES.RECON_ENABLED resolves to "recon_enabled"', () => {
    expect(PLATFORM_FEATURES.RECON_ENABLED).toBe('recon_enabled');
  });

  it('isValidFeatureKey accepts "recon_enabled"', () => {
    expect(isValidFeatureKey('recon_enabled')).toBe(true);
  });

  it('seed row exists with default_enabled: true', async () => {
    const { FLAG_SEEDS } = await import('../database/seeds/feature-flags');
    const recon = FLAG_SEEDS.find((f) => f.key === 'recon_enabled');
    expect(recon).toBeDefined();
    expect(recon!.default_enabled).toBe(true);
    expect(recon!.name).toBeTruthy();
    expect(recon!.description).toBe('Recon AI pentester');
  });

  it('seedFeatureFlags writes recon_enabled row via upsert', async () => {
    const { query } = await import('../database/connection');
    const { seedFeatureFlags } = await import('../database/seeds/feature-flags');
    await seedFeatureFlags();

    const reconCall = (query as any).mock.calls.find(
      (c: any[]) => Array.isArray(c[1]) && c[1][0] === 'recon_enabled'
    );
    expect(reconCall).toBeDefined();
    expect(reconCall[1]).toEqual(['recon_enabled', 'Recon', 'Recon AI pentester', true]);
    expect(reconCall[0]).toContain('ON CONFLICT');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../shared/database/repositories/feature-flag-repository', () => {
  const getOrgOverride = vi.fn();
  const getByKey = vi.fn();
  const listAllOrgOverridesWithFlags = vi.fn();
  return {
    FeatureFlagRepository: vi.fn().mockImplementation(() => ({
      getOrgOverride,
      getByKey,
      listAllOrgOverridesWithFlags,
    })),
    __mocks: { getOrgOverride, getByKey, listAllOrgOverridesWithFlags },
  };
});

import { isFlagEnabled, _cache } from '../utils/feature-flags';
// @ts-expect-error vitest mock-injected export
import { __mocks } from '../../shared/database/repositories/feature-flag-repository';

const { getOrgOverride, getByKey } = __mocks as any;

const ORG = 'org-recon-test';

beforeEach(() => {
  _cache.clear();
  vi.clearAllMocks();
});

describe('recon_enabled via isFlagEnabled', () => {
  it('returns true by default for any org when seed row is default_enabled=true', async () => {
    getOrgOverride.mockResolvedValue(null);
    getByKey.mockResolvedValue({
      key: 'recon_enabled',
      default_enabled: true,
      rollout_percent: 100,
    });

    const result = await isFlagEnabled(ORG, 'recon_enabled' as any);
    expect(result).toBe(true);
  });

  it('returns false when a per-org override sets enabled=false', async () => {
    getOrgOverride.mockResolvedValue({ enabled: false });

    const result = await isFlagEnabled(ORG, 'recon_enabled' as any);
    expect(result).toBe(false);
  });

  it('returns true when a per-org override sets enabled=true even if default is false', async () => {
    getOrgOverride.mockResolvedValue({ enabled: true });

    const result = await isFlagEnabled(ORG, 'recon_enabled' as any);
    expect(result).toBe(true);
  });
});

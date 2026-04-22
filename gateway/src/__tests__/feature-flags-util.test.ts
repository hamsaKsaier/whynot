import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import { isFlagEnabled, invalidateFlag, invalidateOrg, resolveAllFlags, _cache } from '../utils/feature-flags';
// @ts-expect-error vitest mock-injected export
import { __mocks } from '../../shared/database/repositories/feature-flag-repository';

const { getOrgOverride, getByKey, listAllOrgOverridesWithFlags } = __mocks as any;

const ORG = 'org-111';
const KEY = 'ai_multi_provider' as any;

beforeEach(() => {
  _cache.clear();
  vi.clearAllMocks();
});

describe('isFlagEnabled', () => {
  it('returns override value when org override exists', async () => {
    getOrgOverride.mockResolvedValue({ enabled: true });
    expect(await isFlagEnabled(ORG, KEY)).toBe(true);
    expect(getOrgOverride).toHaveBeenCalledWith(ORG, KEY);
  });

  it('returns default_enabled when no override exists', async () => {
    getOrgOverride.mockResolvedValue(null);
    getByKey.mockResolvedValue({ key: KEY, default_enabled: true, rollout_percent: 0 });
    expect(await isFlagEnabled(ORG, KEY)).toBe(true);
  });

  it('returns false when flag not found in DB', async () => {
    getOrgOverride.mockResolvedValue(null);
    getByKey.mockResolvedValue(null);
    expect(await isFlagEnabled(ORG, KEY)).toBe(false);
  });

  it('uses rollout_percent when default_enabled is false', async () => {
    getOrgOverride.mockResolvedValue(null);
    getByKey.mockResolvedValue({ key: KEY, default_enabled: false, rollout_percent: 100 });
    expect(await isFlagEnabled(ORG, KEY)).toBe(true);
  });

  it('does not use rollout when default_enabled is true', async () => {
    getOrgOverride.mockResolvedValue(null);
    getByKey.mockResolvedValue({ key: KEY, default_enabled: true, rollout_percent: 0 });
    expect(await isFlagEnabled(ORG, KEY)).toBe(true);
  });
});

describe('cache behaviour', () => {
  it('serves from cache on second call within TTL', async () => {
    getOrgOverride.mockResolvedValue({ enabled: false });
    await isFlagEnabled(ORG, KEY);
    await isFlagEnabled(ORG, KEY);
    expect(getOrgOverride).toHaveBeenCalledTimes(1);
  });

  it('refetches after TTL expires', async () => {
    getOrgOverride.mockResolvedValue({ enabled: false });
    await isFlagEnabled(ORG, KEY);

    const entry = _cache.get(`${ORG}:${KEY}`)!;
    entry.expiresAt = Date.now() - 1;

    getOrgOverride.mockResolvedValue({ enabled: true });
    const result = await isFlagEnabled(ORG, KEY);
    expect(result).toBe(true);
    expect(getOrgOverride).toHaveBeenCalledTimes(2);
  });
});

describe('invalidateFlag', () => {
  it('removes specific cache entry', async () => {
    getOrgOverride.mockResolvedValue({ enabled: true });
    await isFlagEnabled(ORG, KEY);
    expect(_cache.size).toBe(1);

    invalidateFlag(ORG, KEY);
    expect(_cache.size).toBe(0);
  });
});

describe('invalidateOrg', () => {
  it('removes all cache entries for a given org', async () => {
    getOrgOverride.mockResolvedValue({ enabled: true });
    await isFlagEnabled(ORG, 'ai_multi_provider' as any);

    _cache.clear();
    _cache.set(`${ORG}:flag_a`, { value: true, expiresAt: Date.now() + 60000 });
    _cache.set(`${ORG}:flag_b`, { value: false, expiresAt: Date.now() + 60000 });
    _cache.set('other-org:flag_a', { value: true, expiresAt: Date.now() + 60000 });

    invalidateOrg(ORG);
    expect(_cache.size).toBe(1);
    expect(_cache.has('other-org:flag_a')).toBe(true);
  });
});

describe('resolveAllFlags', () => {
  it('returns resolved map for an org', async () => {
    listAllOrgOverridesWithFlags.mockResolvedValue([
      { key: 'ai_multi_provider', default_enabled: false, rollout_percent: 0, override_enabled: true },
      { key: 'payg_billing', default_enabled: true, rollout_percent: 0, override_enabled: null },
      { key: 'advanced_analytics', default_enabled: false, rollout_percent: 0, override_enabled: null },
    ]);

    const flags = await resolveAllFlags(ORG);
    expect(flags).toEqual({
      ai_multi_provider: true,
      payg_billing: true,
      advanced_analytics: false,
    });
  });

  it('uses rollout_percent in resolveAllFlags when default_enabled is false', async () => {
    listAllOrgOverridesWithFlags.mockResolvedValue([
      { key: 'payg_billing', default_enabled: false, rollout_percent: 100, override_enabled: null },
    ]);

    const flags = await resolveAllFlags(ORG);
    expect(flags.payg_billing).toBe(true);
  });
});

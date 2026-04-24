/**
 * Recon feature-flag edge cases.
 *
 * Covers: default-on for fresh orgs, per-org override overriding default,
 * deterministic MD5-based percentage rollout (0% / 100%), and the 60s
 * in-memory cache TTL (no stale values after the window elapses).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../shared/database/repositories/feature-flag-repository', () => {
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

import { isFlagEnabled, _cache } from '../../utils/feature-flags';
// @ts-expect-error vitest mock-injected export
import { __mocks } from '../../../shared/database/repositories/feature-flag-repository';

const { getOrgOverride, getByKey } = __mocks as {
  getOrgOverride: ReturnType<typeof vi.fn>;
  getByKey: ReturnType<typeof vi.fn>;
};

const ORG = 'org-recon-edge';
const ORG_B = 'org-recon-edge-b';

beforeEach(() => {
  _cache.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('recon_enabled flag — default-on for a fresh workspace', () => {
  it('returns true when there is no org override and the flag row defaults on', async () => {
    getOrgOverride.mockResolvedValue(null);
    getByKey.mockResolvedValue({
      key: 'recon_enabled',
      default_enabled: true,
      rollout_percent: 100,
    });

    await expect(isFlagEnabled(ORG, 'recon_enabled' as any)).resolves.toBe(true);
    // Second call is cached — no extra DB hits.
    await expect(isFlagEnabled(ORG, 'recon_enabled' as any)).resolves.toBe(true);
    expect(getByKey).toHaveBeenCalledTimes(1);
    expect(getOrgOverride).toHaveBeenCalledTimes(1);
  });
});

describe('recon_enabled flag — per-org override', () => {
  it('override enabled=false wins even when platform default is true', async () => {
    getOrgOverride.mockResolvedValue({ enabled: false });
    getByKey.mockResolvedValue({
      key: 'recon_enabled',
      default_enabled: true,
      rollout_percent: 100,
    });

    await expect(isFlagEnabled(ORG, 'recon_enabled' as any)).resolves.toBe(false);
    // When an override exists, the platform row is never consulted.
    expect(getByKey).not.toHaveBeenCalled();
  });

  it('override enabled=true wins even when platform default is false at 0% rollout', async () => {
    getOrgOverride.mockResolvedValue({ enabled: true });
    getByKey.mockResolvedValue({
      key: 'recon_enabled',
      default_enabled: false,
      rollout_percent: 0,
    });

    await expect(isFlagEnabled(ORG, 'recon_enabled' as any)).resolves.toBe(true);
    expect(getByKey).not.toHaveBeenCalled();
  });

  it('isolates cache entries between orgs — one override does not affect another', async () => {
    getOrgOverride.mockImplementation(async (orgId: string) => {
      if (orgId === ORG) return { enabled: false };
      return null;
    });
    getByKey.mockResolvedValue({
      key: 'recon_enabled',
      default_enabled: true,
      rollout_percent: 100,
    });

    await expect(isFlagEnabled(ORG, 'recon_enabled' as any)).resolves.toBe(false);
    await expect(isFlagEnabled(ORG_B, 'recon_enabled' as any)).resolves.toBe(true);
  });
});

describe('recon_enabled flag — deterministic MD5 rollout', () => {
  it('0% rollout with default_enabled=false returns false for every org', async () => {
    getOrgOverride.mockResolvedValue(null);
    getByKey.mockResolvedValue({
      key: 'recon_enabled',
      default_enabled: false,
      rollout_percent: 0,
    });

    for (const orgId of [ORG, ORG_B, 'org-random-1', 'org-random-2']) {
      _cache.clear();
      await expect(isFlagEnabled(orgId, 'recon_enabled' as any)).resolves.toBe(false);
    }
  });

  it('100% rollout with default_enabled=false returns true for every org', async () => {
    getOrgOverride.mockResolvedValue(null);
    getByKey.mockResolvedValue({
      key: 'recon_enabled',
      default_enabled: false,
      rollout_percent: 100,
    });

    for (const orgId of [ORG, ORG_B, 'org-random-3', 'org-random-4']) {
      _cache.clear();
      await expect(isFlagEnabled(orgId, 'recon_enabled' as any)).resolves.toBe(true);
    }
  });

  it('result is stable for the same orgId across repeated calls (deterministic hash)', async () => {
    getOrgOverride.mockResolvedValue(null);
    getByKey.mockResolvedValue({
      key: 'recon_enabled',
      default_enabled: false,
      rollout_percent: 50,
    });

    // Cache disabled by clearing between calls — result must still be stable.
    const first = await (async () => {
      _cache.clear();
      return isFlagEnabled(ORG, 'recon_enabled' as any);
    })();
    const second = await (async () => {
      _cache.clear();
      return isFlagEnabled(ORG, 'recon_enabled' as any);
    })();
    expect(first).toBe(second);
  });
});

describe('recon_enabled flag — 60s cache TTL', () => {
  it('does NOT return a stale value after the cache window expires (61s later)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T10:00:00Z'));

    getOrgOverride.mockResolvedValue(null);
    getByKey.mockResolvedValue({
      key: 'recon_enabled',
      default_enabled: true,
      rollout_percent: 100,
    });

    await expect(isFlagEnabled(ORG, 'recon_enabled' as any)).resolves.toBe(true);

    // Advance past TTL; underlying flag has now been toggled off via override.
    vi.setSystemTime(new Date('2026-04-24T10:01:01Z')); // +61s
    getOrgOverride.mockResolvedValue({ enabled: false });

    await expect(isFlagEnabled(ORG, 'recon_enabled' as any)).resolves.toBe(false);
    // The second lookup hit the repository again because the cache expired.
    expect(getOrgOverride).toHaveBeenCalledTimes(2);
  });

  it('returns the cached value within the 60s window even if upstream changes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T10:00:00Z'));

    getOrgOverride.mockResolvedValue(null);
    getByKey.mockResolvedValue({
      key: 'recon_enabled',
      default_enabled: true,
      rollout_percent: 100,
    });

    await expect(isFlagEnabled(ORG, 'recon_enabled' as any)).resolves.toBe(true);

    // Just before TTL expiry. Upstream has flipped, but the cache still serves
    // the old value.
    vi.setSystemTime(new Date('2026-04-24T10:00:59Z'));
    getOrgOverride.mockResolvedValue({ enabled: false });

    await expect(isFlagEnabled(ORG, 'recon_enabled' as any)).resolves.toBe(true);
    expect(getOrgOverride).toHaveBeenCalledTimes(1);
  });
});

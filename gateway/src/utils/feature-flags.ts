import { FeatureFlagRepository } from '../../shared/database/repositories/feature-flag-repository';
import { type PlatformFeatureKey, isValidFeatureKey } from '../../shared/constants/platform-features';
import crypto from 'crypto';

const featureFlagRepository = new FeatureFlagRepository();

type CacheEntry = { value: boolean; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function cacheKey(orgId: string, key: string): string {
  return `${orgId}:${key}`;
}

function isRolledOut(orgId: string, flagKey: string, rolloutPercent: number): boolean {
  const hash = crypto.createHash('md5').update(`${orgId}:${flagKey}`).digest();
  const value = hash.readUInt16BE(0) % 100;
  return value < rolloutPercent;
}

export async function isFlagEnabled(orgId: string, key: PlatformFeatureKey): Promise<boolean> {
  const ck = cacheKey(orgId, key);
  const cached = cache.get(ck);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const override = await featureFlagRepository.getOrgOverride(orgId, key);
  if (override) {
    cache.set(ck, { value: override.enabled, expiresAt: Date.now() + TTL_MS });
    return override.enabled;
  }

  const flag = await featureFlagRepository.getByKey(key);
  if (!flag) {
    cache.set(ck, { value: false, expiresAt: Date.now() + TTL_MS });
    return false;
  }

  let enabled = flag.default_enabled;
  if (!enabled && flag.rollout_percent > 0) {
    enabled = isRolledOut(orgId, key, flag.rollout_percent);
  }

  cache.set(ck, { value: enabled, expiresAt: Date.now() + TTL_MS });
  return enabled;
}

export function invalidateFlag(orgId: string, key: PlatformFeatureKey): void {
  cache.delete(cacheKey(orgId, key));
}

export function invalidateOrg(orgId: string): void {
  const prefix = `${orgId}:`;
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) {
      cache.delete(k);
    }
  }
}

export async function resolveAllFlags(orgId: string): Promise<Record<string, boolean>> {
  const rows = await featureFlagRepository.listAllOrgOverridesWithFlags(orgId);
  const result: Record<string, boolean> = {};
  for (const row of rows) {
    if (row.override_enabled !== null) {
      result[row.key] = row.override_enabled;
    } else if (row.default_enabled) {
      result[row.key] = true;
    } else if (row.rollout_percent > 0) {
      result[row.key] = isRolledOut(orgId, row.key, row.rollout_percent);
    } else {
      result[row.key] = false;
    }
  }
  return result;
}

export { isValidFeatureKey };

export { cache as _cache };

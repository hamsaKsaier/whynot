import { describe, it, expect } from 'vitest';
import {
  PLATFORM_FEATURES,
  ALL_PLATFORM_FEATURE_KEYS,
  isValidFeatureKey,
  type PlatformFeatureKey,
} from '../constants/platform-features';

describe('platform-features', () => {
  describe('PLATFORM_FEATURES', () => {
    it('contains all expected keys', () => {
      expect(PLATFORM_FEATURES).toEqual({
        AI_MULTI_PROVIDER: 'ai_multi_provider',
        PAYG_BILLING: 'payg_billing',
        LANDING_LEAD_CAPTURE: 'landing_lead_capture',
        ADVANCED_ANALYTICS: 'advanced_analytics',
        SUPERADMIN_IMPERSONATION: 'superadmin_impersonation',
        LANGUAGE_SWITCHER: 'language_switcher',
        RECON_ENABLED: 'recon_enabled',
      });
    });

    it('has unique values', () => {
      const values = Object.values(PLATFORM_FEATURES);
      expect(new Set(values).size).toBe(values.length);
    });

    it('uses snake_case for all values', () => {
      for (const value of Object.values(PLATFORM_FEATURES)) {
        expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    });
  });

  describe('ALL_PLATFORM_FEATURE_KEYS', () => {
    it('contains every value from PLATFORM_FEATURES', () => {
      for (const value of Object.values(PLATFORM_FEATURES)) {
        expect(ALL_PLATFORM_FEATURE_KEYS).toContain(value);
      }
    });

    it('has same length as PLATFORM_FEATURES values', () => {
      expect(ALL_PLATFORM_FEATURE_KEYS.length).toBe(
        Object.keys(PLATFORM_FEATURES).length
      );
    });
  });

  describe('isValidFeatureKey', () => {
    it('returns true for every registry value', () => {
      for (const key of ALL_PLATFORM_FEATURE_KEYS) {
        expect(isValidFeatureKey(key)).toBe(true);
      }
    });

    it('returns false for unknown keys', () => {
      expect(isValidFeatureKey('unknown_feature')).toBe(false);
      expect(isValidFeatureKey('')).toBe(false);
      expect(isValidFeatureKey('AI_MULTI_PROVIDER')).toBe(false); // uppercase enum key, not the value
    });

    it('narrows the type correctly', () => {
      const key = 'ai_multi_provider';
      if (isValidFeatureKey(key)) {
        const _typed: PlatformFeatureKey = key;
        expect(_typed).toBe('ai_multi_provider');
      }
    });
  });
});

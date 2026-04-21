import { describe, it, expect } from 'vitest';
import {
  PLANS,
  VALID_PLAN_SLUGS,
  isPlanSlug,
  getPlanDefinition,
  DEFAULT_TRIAL_DAYS,
  DEFAULT_PAYG_RATES,
  type PlanSlug,
  type PlanTier,
} from '../constants/pricing';

describe('pricing', () => {
  describe('PLANS', () => {
    it('defines free plan at 0 cents', () => {
      expect(PLANS.free.name).toBe('Free');
      expect(PLANS.free.monthlyCents).toBe(0n);
      expect(PLANS.free.tier).toBe('byo_keys');
    });

    it('defines pro_byo plan at 2900 cents', () => {
      expect(PLANS.pro_byo.monthlyCents).toBe(2900n);
      expect(PLANS.pro_byo.tier).toBe('byo_keys');
    });

    it('defines pro_managed plan at 4900 cents', () => {
      expect(PLANS.pro_managed.monthlyCents).toBe(4900n);
      expect(PLANS.pro_managed.tier).toBe('managed_payg');
    });

    it('uses bigint for all monetary values', () => {
      for (const plan of Object.values(PLANS)) {
        expect(typeof plan.monthlyCents).toBe('bigint');
      }
    });
  });

  describe('VALID_PLAN_SLUGS', () => {
    it('contains all plan keys', () => {
      expect(VALID_PLAN_SLUGS).toContain('free');
      expect(VALID_PLAN_SLUGS).toContain('pro_byo');
      expect(VALID_PLAN_SLUGS).toContain('pro_managed');
      expect(VALID_PLAN_SLUGS).toHaveLength(3);
    });
  });

  describe('isPlanSlug', () => {
    it('returns true for valid slugs', () => {
      expect(isPlanSlug('free')).toBe(true);
      expect(isPlanSlug('pro_byo')).toBe(true);
      expect(isPlanSlug('pro_managed')).toBe(true);
    });

    it('returns false for invalid slugs', () => {
      expect(isPlanSlug('enterprise')).toBe(false);
      expect(isPlanSlug('')).toBe(false);
      expect(isPlanSlug('FREE')).toBe(false);
    });
  });

  describe('getPlanDefinition', () => {
    it('returns correct definition for each slug', () => {
      const free = getPlanDefinition('free');
      expect(free.name).toBe('Free');
      expect(free.monthlyCents).toBe(0n);

      const proByo = getPlanDefinition('pro_byo');
      expect(proByo.name).toBe('Pro (Bring Your Own Keys)');

      const proManaged = getPlanDefinition('pro_managed');
      expect(proManaged.tier).toBe('managed_payg');
    });
  });

  describe('DEFAULT_TRIAL_DAYS', () => {
    it('is 14', () => {
      expect(DEFAULT_TRIAL_DAYS).toBe(14);
    });
  });

  describe('DEFAULT_PAYG_RATES', () => {
    it('defines all expected operation types', () => {
      expect(DEFAULT_PAYG_RATES.test_generation).toBe(50n);
      expect(DEFAULT_PAYG_RATES.test_execution).toBe(10n);
      expect(DEFAULT_PAYG_RATES.qa_loop_iteration).toBe(30n);
      expect(DEFAULT_PAYG_RATES.auto_fix_attempt).toBe(100n);
      expect(DEFAULT_PAYG_RATES.visual_regression).toBe(15n);
      expect(DEFAULT_PAYG_RATES.qa_monitor_session).toBe(200n);
      expect(DEFAULT_PAYG_RATES.ci_scan).toBe(200n);
    });

    it('uses bigint for all rates', () => {
      for (const rate of Object.values(DEFAULT_PAYG_RATES)) {
        expect(typeof rate).toBe('bigint');
      }
    });

    it('has 7 non-recon operation types plus 6 recon event types (13 total)', () => {
      expect(Object.keys(DEFAULT_PAYG_RATES)).toHaveLength(13);
    });

    it('defines recon PAYG event types with expected rates', () => {
      expect(DEFAULT_PAYG_RATES.recon_scan_run).toBe(5000n);
      expect(DEFAULT_PAYG_RATES.recon_phase_fingerprinting).toBe(200n);
      expect(DEFAULT_PAYG_RATES.recon_phase_discovery).toBe(800n);
      expect(DEFAULT_PAYG_RATES.recon_phase_vuln_analysis).toBe(1500n);
      expect(DEFAULT_PAYG_RATES.recon_phase_exploitation).toBe(2000n);
      expect(DEFAULT_PAYG_RATES.recon_phase_reporting).toBe(500n);
    });

    it('recon per-phase rates sum to the full-scan baseline', () => {
      const perPhaseSum =
        DEFAULT_PAYG_RATES.recon_phase_fingerprinting +
        DEFAULT_PAYG_RATES.recon_phase_discovery +
        DEFAULT_PAYG_RATES.recon_phase_vuln_analysis +
        DEFAULT_PAYG_RATES.recon_phase_exploitation +
        DEFAULT_PAYG_RATES.recon_phase_reporting;
      expect(perPhaseSum).toBe(DEFAULT_PAYG_RATES.recon_scan_run);
    });
  });
});

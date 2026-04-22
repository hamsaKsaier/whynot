import { describe, it, expect } from 'vitest';
import { CREDIT_COSTS, getCreditCost, getCreditDescription, type CreditCostKey } from '../../payments/credit-cost-mapper';

describe('CREDIT_COSTS', () => {
  it('defines integer costs for all operations', () => {
    for (const [key, value] of Object.entries(CREDIT_COSTS)) {
      expect(typeof value).toBe('number');
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
    }
  });

  it('contains expected operation keys', () => {
    const expectedKeys = [
      'TEST_GENERATION',
      'TEST_EXECUTION',
      'QA_LOOP_ITERATION',
      'QA_LOOP_SESSION_RESERVE',
      'VISUAL_REGRESSION_COMPARISON',
      'CHAOS_TEST_ITERATION',
      'AUTO_FIX_ATTEMPT',
      'AUTO_FIX_RETEST_ITERATION',
      'QA_MONITOR_SESSION',
      'CI_SCAN',
    ];
    for (const key of expectedKeys) {
      expect(CREDIT_COSTS).toHaveProperty(key);
    }
  });
});

describe('getCreditCost', () => {
  it('returns correct cost for each operation', () => {
    expect(getCreditCost('TEST_GENERATION')).toBe(3);
    expect(getCreditCost('TEST_EXECUTION')).toBe(1);
    expect(getCreditCost('QA_LOOP_ITERATION')).toBe(2);
    expect(getCreditCost('QA_LOOP_SESSION_RESERVE')).toBe(10);
    expect(getCreditCost('AUTO_FIX_ATTEMPT')).toBe(5);
    expect(getCreditCost('CI_SCAN')).toBe(10);
  });
});

describe('getCreditDescription', () => {
  it('returns base description without detail', () => {
    expect(getCreditDescription('TEST_GENERATION')).toBe('Test case generation');
    expect(getCreditDescription('TEST_EXECUTION')).toBe('Test execution');
    expect(getCreditDescription('QA_LOOP_ITERATION')).toBe('QA Loop iteration');
  });

  it('appends detail to description', () => {
    expect(getCreditDescription('TEST_GENERATION', 'session-abc')).toBe(
      'Test case generation: session-abc',
    );
  });

  it('returns description for all known operations', () => {
    const keys: CreditCostKey[] = Object.keys(CREDIT_COSTS) as CreditCostKey[];
    for (const key of keys) {
      const desc = getCreditDescription(key);
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    }
  });
});

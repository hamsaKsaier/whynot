import { describe, it, expect } from 'vitest';
import {
  clampQuantity,
  computeTotalCredits,
  recommendPack,
  estimateMonthlyCostCents,
  formatCents,
  CREDIT_PACKS,
  MAX_QUANTITY,
  type PaygRate,
} from '../payg-calculator';

const RATES: PaygRate[] = [
  { event: 'test_generation', credits: 50 },
  { event: 'test_execution', credits: 10 },
  { event: 'qa_loop_iteration', credits: 30 },
  { event: 'auto_fix_attempt', credits: 100 },
  { event: 'visual_regression', credits: 15 },
  { event: 'qa_monitor_session', credits: 200 },
  { event: 'ci_scan', credits: 200 },
];

describe('clampQuantity', () => {
  it('returns 0 for negative values', () => {
    expect(clampQuantity(-5)).toBe(0);
    expect(clampQuantity(-1)).toBe(0);
  });

  it('returns 0 for NaN and Infinity', () => {
    expect(clampQuantity(NaN)).toBe(0);
    expect(clampQuantity(Infinity)).toBe(0);
    expect(clampQuantity(-Infinity)).toBe(0);
  });

  it('floors fractional values', () => {
    expect(clampQuantity(3.7)).toBe(3);
    expect(clampQuantity(9.99)).toBe(9);
  });

  it('caps at MAX_QUANTITY', () => {
    expect(clampQuantity(MAX_QUANTITY + 1)).toBe(MAX_QUANTITY);
    expect(clampQuantity(999_999)).toBe(MAX_QUANTITY);
  });

  it('passes through valid integers', () => {
    expect(clampQuantity(0)).toBe(0);
    expect(clampQuantity(100)).toBe(100);
    expect(clampQuantity(MAX_QUANTITY)).toBe(MAX_QUANTITY);
  });
});

describe('computeTotalCredits', () => {
  it('returns 0 when all quantities are zero', () => {
    const quantities: Record<string, number> = {};
    for (const r of RATES) quantities[r.event] = 0;
    expect(computeTotalCredits(RATES, quantities)).toBe(0);
  });

  it('computes correct total for the worked example', () => {
    const quantities: Record<string, number> = {
      test_generation: 50,
      test_execution: 200,
      qa_loop_iteration: 0,
      auto_fix_attempt: 10,
      visual_regression: 0,
      qa_monitor_session: 0,
      ci_scan: 0,
    };
    expect(computeTotalCredits(RATES, quantities)).toBe(5500);
  });

  it('handles missing quantity keys as zero', () => {
    expect(computeTotalCredits(RATES, {})).toBe(0);
  });

  it('clamps negative quantities to zero', () => {
    const quantities = { test_generation: -10, test_execution: 5 };
    expect(computeTotalCredits(RATES, quantities)).toBe(50);
  });

  it('clamps quantities above MAX_QUANTITY', () => {
    const quantities = { test_generation: MAX_QUANTITY + 100 };
    expect(computeTotalCredits(RATES, quantities)).toBe(50 * MAX_QUANTITY);
  });
});

describe('recommendPack', () => {
  it('recommends starter pack for small totals', () => {
    expect(recommendPack(0)).toBe(CREDIT_PACKS[0]);
    expect(recommendPack(500)).toBe(CREDIT_PACKS[0]);
    expect(recommendPack(999)).toBe(CREDIT_PACKS[0]);
  });

  it('recommends growth pack at 10k threshold', () => {
    expect(recommendPack(10_000)).toBe(CREDIT_PACKS[1]);
    expect(recommendPack(50_000)).toBe(CREDIT_PACKS[1]);
  });

  it('recommends scale pack at 100k threshold', () => {
    expect(recommendPack(100_000)).toBe(CREDIT_PACKS[2]);
    expect(recommendPack(500_000)).toBe(CREDIT_PACKS[2]);
  });

  it('returns starter for exactly 1000 credits', () => {
    expect(recommendPack(1000)).toBe(CREDIT_PACKS[0]);
  });
});

describe('estimateMonthlyCostCents', () => {
  it('returns 0 for zero credits', () => {
    expect(estimateMonthlyCostCents(0)).toBe(0);
  });

  it('returns one starter pack for 500 credits', () => {
    expect(estimateMonthlyCostCents(500)).toBe(1000);
  });

  it('returns two starter packs for 1500 credits', () => {
    expect(estimateMonthlyCostCents(1500)).toBe(2000);
  });

  it('uses growth pricing for 10k+ credits', () => {
    expect(estimateMonthlyCostCents(10_000)).toBe(8000);
    expect(estimateMonthlyCostCents(15_000)).toBe(16_000);
  });

  it('uses scale pricing for 100k+ credits', () => {
    expect(estimateMonthlyCostCents(100_000)).toBe(60_000);
    expect(estimateMonthlyCostCents(200_000)).toBe(120_000);
  });
});

describe('formatCents', () => {
  it('formats USD for en locale', () => {
    expect(formatCents(2900, 'en-US')).toBe('$29');
  });

  it('formats with decimals when needed', () => {
    expect(formatCents(2950, 'en-US')).toBe('$29.5');
  });

  it('formats zero correctly', () => {
    expect(formatCents(0, 'en-US')).toBe('$0');
  });

  it.each([
    ['en-US', 999, '$9.99'],
    ['de', 999, '9,99\u00a0$'],
  ])('formats %s locale: %i cents → %s', (locale, cents, expected) => {
    expect(formatCents(cents, locale, { minimumFractionDigits: 2 })).toBe(expected);
  });

  it('formats for ar-SA locale', () => {
    const result = formatCents(999, 'ar-SA', { minimumFractionDigits: 2 });
    expect(result).toContain('$');
  });
});

export const CREDIT_COSTS = {
  TEST_GENERATION: 3,
  TEST_EXECUTION: 1,
  QA_LOOP_ITERATION: 2,
  QA_LOOP_SESSION_RESERVE: 10,
  VISUAL_REGRESSION_COMPARISON: 1,
  CHAOS_TEST_ITERATION: 3,
  AUTO_FIX_ATTEMPT: 5,
  AUTO_FIX_RETEST_ITERATION: 3,
  QA_MONITOR_SESSION: 10,
  CI_SCAN: 10,
} as const;

export type CreditCostKey = keyof typeof CREDIT_COSTS;

export function getCreditCost(operation: CreditCostKey): number {
  return CREDIT_COSTS[operation];
}

export function getCreditDescription(operation: CreditCostKey, detail?: string): string {
  const descriptions: Record<CreditCostKey, string> = {
    TEST_GENERATION: 'Test case generation',
    TEST_EXECUTION: 'Test execution',
    QA_LOOP_ITERATION: 'QA Loop iteration',
    QA_LOOP_SESSION_RESERVE: 'QA Loop session',
    VISUAL_REGRESSION_COMPARISON: 'Visual regression comparison',
    CHAOS_TEST_ITERATION: 'Chaos test iteration',
    AUTO_FIX_ATTEMPT: 'Auto-fix code generation',
    AUTO_FIX_RETEST_ITERATION: 'Auto-fix retest iteration',
    QA_MONITOR_SESSION: 'Scheduled QA monitor session',
    CI_SCAN: 'CI/CD integration scan',
  };

  const base = descriptions[operation] || operation;
  return detail ? `${base}: ${detail}` : base;
}

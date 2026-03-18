/**
 * Maps platform operations to abstract credit costs.
 * These values can later be overridden via system_settings in the admin panel.
 */
export const CREDIT_COSTS = {
  // Test operations
  TEST_GENERATION: 3,
  TEST_EXECUTION: 1,

  // QA Loop operations
  QA_LOOP_ITERATION: 2,
  QA_LOOP_SESSION_RESERVE: 10, // upfront reserve when starting a session (5 iterations)

  // Visual regression
  VISUAL_REGRESSION_COMPARISON: 1,

  // Chaos testing
  CHAOS_TEST_ITERATION: 3,
} as const;

export type CreditCostKey = keyof typeof CREDIT_COSTS;

/**
 * Get the credit cost for a given operation.
 */
export function getCreditCost(operation: CreditCostKey): number {
  return CREDIT_COSTS[operation];
}

/**
 * Get a human-readable description for a credit operation.
 */
export function getCreditDescription(operation: CreditCostKey, detail?: string): string {
  const descriptions: Record<CreditCostKey, string> = {
    TEST_GENERATION: 'Test case generation',
    TEST_EXECUTION: 'Test execution',
    QA_LOOP_ITERATION: 'QA Loop iteration',
    QA_LOOP_SESSION_RESERVE: 'QA Loop session',
    VISUAL_REGRESSION_COMPARISON: 'Visual regression comparison',
    CHAOS_TEST_ITERATION: 'Chaos test iteration',
  };

  const base = descriptions[operation] || operation;
  return detail ? `${base}: ${detail}` : base;
}

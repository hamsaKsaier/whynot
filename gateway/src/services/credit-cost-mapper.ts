/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CREDIT SYSTEM — How it works
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * OVERVIEW:
 * Credits are the internal currency used to gate platform operations. Each
 * workspace has a credit balance tracked in the `credit_balances` table.
 *
 * SIGNUP:
 * When a new workspace is created, `BillingService.provisionNewWorkspace()`
 * is called. This creates a subscription on the 'free-trial' plan and grants
 * the plan's `credits_per_period` credits (defined in the `plans` DB table).
 * The exact number depends on the plan configuration in the database.
 *
 * DEDUCTION DURING QA SCAN:
 * 1. Before starting a session, the `requireCredits('QA_LOOP_SESSION_RESERVE')`
 *    middleware checks the workspace has at least 10 credits (the reserve cost).
 * 2. If sufficient, the session starts. After successful creation,
 *    `deductCredits()` subtracts 10 credits from the balance.
 * 3. Additional per-iteration costs (QA_LOOP_ITERATION = 2 credits) are
 *    deducted by the orchestrator during the session.
 *
 * CREDIT ESTIMATION:
 * The frontend can estimate cost before a scan by reading the CREDIT_COSTS
 * below. Example: a 5-iteration scan costs ~10 (reserve) + 5*2 (iterations)
 * = 20 credits.
 *
 * POST-SCAN DISPLAY:
 * After a scan, the cost is visible in the session's cost info (emitted via
 * WebSocket) and in the billing page which calls `BillingService.getUsageSummary()`.
 *
 * ZERO CREDITS:
 * The `requireCredits` middleware returns HTTP 402 with code
 * 'INSUFFICIENT_CREDITS', showing required vs available credits and a link
 * to /billing. The frontend intercepts this and shows an upgrade prompt.
 *
 * REFILLS:
 * Credits refill monthly via Stripe webhook (invoice.paid) which calls
 * `BillingService.refillCredits()`. Admins can also grant credits manually.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
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

  // Auto-fix
  AUTO_FIX_ATTEMPT: 5,
  AUTO_FIX_RETEST_ITERATION: 3,

  // Monitors
  QA_MONITOR_SESSION: 10,

  // CI Integration
  CI_SCAN: 10,
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
    AUTO_FIX_ATTEMPT: 'Auto-fix code generation',
    AUTO_FIX_RETEST_ITERATION: 'Auto-fix retest iteration',
    QA_MONITOR_SESSION: 'Scheduled QA monitor session',
    CI_SCAN: 'CI/CD integration scan',
  };

  const base = descriptions[operation] || operation;
  return detail ? `${base}: ${detail}` : base;
}

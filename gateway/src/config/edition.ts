import { env } from './env';

/**
 * Open-core edition helpers.
 *
 * The same codebase serves two editions:
 *  - Hosted SaaS (default): billing, subscriptions, credits, feature gates,
 *    multi-tenant — the paid product.
 *  - Self-hosted OSS (SELF_HOSTED=true): no billing, all access gates become
 *    pass-through, a single auto-provisioned admin + workspace, bring-your-own
 *    LLM key. The free, self-hostable product.
 *
 * Gating middleware (requireActiveSubscription / requireCredits /
 * requireFeature / requireFeatureLimit) short-circuit to next() when
 * isSelfHosted() is true. Billing routes are unmounted. See env.ts.
 */
export function isSelfHosted(): boolean {
  return env.SELF_HOSTED === true;
}

/**
 * Self-hosted only: when true, requests are auto-authenticated as the default
 * admin (no login screen) — for running locally on a trusted machine. Ignored
 * unless SELF_HOSTED is also true.
 */
export function isAuthDisabled(): boolean {
  return env.SELF_HOSTED === true && env.AUTH_DISABLED === true;
}

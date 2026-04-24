# Recon — Billing & PAYG integration

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/pricing-strategy/`, `.claude/skills/spec-driven-development/`
- Supporting: `.claude/skills/paywall-upgrade-cro/`
- Rules: `.claude/rules/recon-safety.md` (A7)

## Dependencies
- A1, A7, B1, B2

## Task
Wire Recon into the existing PAYG billing system so each scan deducts credits, partial scans bill fairly, and plans get a built-in monthly quota.

### 1. PAYG event types
In `shared/constants/pricing.ts`, add to `DEFAULT_PAYG_RATES`:
```ts
recon_scan_run: 5000n,            // full-scan baseline (~$50 reference)
recon_phase_fingerprinting: 200n,
recon_phase_discovery: 800n,
recon_phase_vuln_analysis: 1500n,
recon_phase_exploitation: 2000n,
recon_phase_reporting: 500n,
```
(The per-phase rates sum to `recon_scan_run`. Use per-phase events for fair billing on cancellation/failure; if a full scan completes, charge `recon_scan_run` once and skip the per-phase events.)

### 2. Plan features
In the plan-feature seed (find via `grep -r 'plan_features' shared/`), add:
- `recon_enabled` (boolean) — true on all paid plans, false on `free`.
- `recon_monthly_scans` (integer) — `free: 0`, `pro_byo: 1`, `pro_managed: 3` (tunable; surface defaults in `shared/constants/pricing.ts`).

### 3. BillingService
- Update `BillingService.recordUsageEvent` to accept the new event types (no signature change if it already uses the `eventType: string` shape — just verify the type union if TypeScript-narrowed).
- Add a helper `BillingService.getReconScansThisMonth(workspaceId)` that returns the count of scans started in the current calendar month.
- Add a helper `BillingService.checkReconQuota(workspaceId)` that returns `{ included_remaining, payg_per_scan_credits }`.

### 4. Endpoints (interaction with C6)
The `POST /api/recon/scans` handler (created in C6) will call:
1. `requireFeature('recon_enabled')` — blocks if plan doesn't include Recon.
2. `BillingService.checkReconQuota(...)`. If `included_remaining > 0`, no credit gate; charge nothing on the start. Otherwise, run the credit gate for `recon_scan_run` credits and pre-authorize them.
3. On scan completion or per-phase completion, write `BillingService.recordUsageEvent({ eventType: ..., quantity: 1 })`.

### Tests
- Unit tests in `gateway/src/__tests__/payments/`:
  - Free plan + 0 included scans → 402/`PAYMENT_REQUIRED` if no credits.
  - `pro_managed` plan with 3 included scans → first 3 scans free; 4th hits PAYG.
  - Cancelled scan that completed only `fingerprinting` → only `recon_phase_fingerprinting` charged.
  - Successful full scan → exactly one `recon_scan_run` event recorded; no per-phase events.
  - Concurrent scan race: two scans started simultaneously by same workspace cannot both consume the last "included" slot.
- 100% coverage on changed billing files.

### i18n
- Backend response messages (5 locales, `gateway/src/i18n/translations/{lng}/{billing,errors}.json`):
  - `errors:recon.quota.exceeded`
  - `errors:recon.payment.required`
  - `success:recon.scan.queued`
  - `billing:recon.scan.includedQuota` — "Included scans remaining: {{count}}"
  - `billing:recon.scan.paygCost` — "This scan will cost {{credits}} credits"

### Documentation
- E3 (docs prompt) will surface a "Pricing & quotas" page in `/docs/recon/`. This prompt only requires that the i18n keys exist.

### Files to modify
- `shared/constants/pricing.ts`
- Plan-feature seed file
- `gateway/src/services/billing-service.ts` (or wherever `BillingService` lives — confirm via `grep -r 'class BillingService' gateway/`)
- `gateway/src/__tests__/payments/billing-service.test.ts`
- All 10 `gateway/src/i18n/translations/{en,ar,fr,de,es}/{billing,errors}.json`

---

### Appendix: Plan taxonomy reconciliation (migration 054)

This spec was authored against the architectural plan slugs (`free`, `pro_byo`, `pro_managed`) defined in `shared/constants/pricing.ts`. At implementation time, the DB retained the legacy slugs seeded by migration 021 (`free-trial`, `starter`, `pro`, `enterprise`) — the two taxonomies never converged. As a result, the recon feature seeder silently no-oped against every paying customer.

Migration `054_reconcile_plan_taxonomy.sql` resolves this:

- Adds `tier` column to `plans`; inserts the architectural plans (`free`, `pro_byo`, `pro_managed`).
- Hides legacy plans from new signups (`is_public = false`) but keeps them selectable for grandfathered `workspace_subscriptions` rows. No subscription data is migrated.
- Sets `tier = 'managed_payg'` on legacy `pro` and `enterprise` (matches the `$99/mo` platform-managed experience existing customers signed up for, so `SubscriptionManager.isManagedPaygTier` routes PAYG debits correctly).
- Carries non-recon `plan_features` forward: `free-trial → free`, `starter → pro_byo`, `pro → pro_managed`.

The recon entitlement constant is extended into `RECON_PLAN_FEATURES_BY_SLUG`, which covers both taxonomies in one lookup table; `DEFAULT_RECON_PLAN_FEATURES` becomes a strictly-typed projection over the architectural slugs. `seedReconPlanFeatures()` iterates the map so every plan row present in the DB — architectural or legacy — receives `recon_enabled` and `recon_monthly_scans`. Legacy quotas mirror their architectural counterparts: `starter = pro_byo = 1`, `pro = pro_managed = 3`, `enterprise = 99`.

Sunset plan: once all legacy subscriptions have churned or been explicitly upgraded, a follow-up migration can archive the legacy `plans` rows and the legacy entries in `RECON_PLAN_FEATURES_BY_SLUG` can be removed.

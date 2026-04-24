# Recon — Billing + feature-flag tests

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/spec-driven-development/`, `.claude/skills/pricing-strategy/`
- Rules: `.claude/rules/recon-safety.md` (A7)

## Dependencies
- B2, B3, C6, F1.

## Task
Lock down the billing + feature-flag interactions for Recon with focused tests that exercise edge cases the per-feature tests in B and C may not cover.

### 1. Billing scenarios
- **Quota consumption**: workspace on `pro_managed` (3 included scans/month). Run 4 scans in the same calendar month. First 3 deduct from quota; 4th deducts PAYG credits. Assert `BillingService.checkReconQuota` returns `included_remaining: 0` after the 3rd. Assert ledger balance after 4th.
- **Quota reset across month boundary**: Mock the system clock; advance to the 1st of the next month; assert `included_remaining` is reset to plan default.
- **Cancellation refund**: Start a scan; cancel mid-`vuln_analysis`. Assert charged events: `recon_phase_fingerprinting`, `recon_phase_discovery`, `recon_phase_vuln_analysis` (the cancelled-during phase IS billed because it ran). NOT charged: `recon_phase_exploitation`, `recon_phase_reporting`. NOT charged: `recon_scan_run` (the scan didn't fully complete).
- **Full completion**: Start a scan that runs all 5 phases. Assert exactly ONE `recon_scan_run` event recorded; NO per-phase events recorded.
- **Stuck scan billing**: A scan that ends in `stuck` is billed for completed phases only.
- **Race**: Two scans started in parallel by the same workspace contend for the last "included" slot. Assert exactly one consumes the slot; the other consumes PAYG.
- **Plan downgrade mid-scan**: A scan is `running` when the workspace downgrades from `pro_managed` to `free`. The running scan completes and bills as expected; new scans on `free` are blocked at gate.
- **Insufficient credits race**: Workspace credit balance is 4999¢; `recon_scan_run` costs 5000¢. Scan creation fails at the gate. No phase events recorded.
- **Per-phase event sums to scan event**: For every plan, `sum(per-phase events) === recon_scan_run` (consistency invariant).

### 2. Feature-flag scenarios
- **Default-on**: A fresh workspace with no flag overrides → `isFlagEnabled('recon_enabled')` returns true.
- **Org override off**: Set the org-level flag to false. UI hides the sidebar entry; API returns 404 on every Recon endpoint; existing scans still visible to internal admin tooling but inaccessible to the workspace.
- **Rollout percent**: Set flag default to 0% rollout, no overrides. Assert the deterministic MD5-based rollout returns false for the test workspace ID. Then set to 100% — returns true.
- **Flag check is cached**: The 60s in-memory cache (per `gateway/src/utils/feature-flags.ts`) doesn't return stale values across cache refresh. Test by toggling the flag and waiting 61s (mocked).

### 3. Plan-feature scenarios
- Plan without `recon_enabled` plan-feature: API returns 402 with `errors:recon.payment.required`.
- Plan with `recon_enabled=true` and `recon_monthly_scans=0`: API allows scan creation; immediately falls through to PAYG check.
- `recon_monthly_scans` non-integer plan-feature value: code rejects gracefully with a 500 + sentry alert (not a silent fallback).

### 4. Coverage assertion
- This prompt's tests fold into `make shell-gateway npm test -- --coverage`. With F1, the combined coverage on billing + flag files must hit 100%.

### Tests
- Implemented as scenarios in sections 1–3.

### i18n
- N/A — billing/flag responses are internal codes + already-translated messages from F1.

### Documentation
- E3's `quotas.md` page reflects the rules tested here.

### Files to modify
- New tests under `gateway/src/__tests__/payments/recon-billing.test.ts`
- New tests under `gateway/src/__tests__/feature-flags/recon-flag.test.ts`
- New tests under `gateway/src/__tests__/recon/plan-features.test.ts`

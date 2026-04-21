# Recon — Pricing-page update

## Agent
No dedicated landing agent — drive via skills.

## Skills
- Primary: `.claude/skills/pricing-strategy/`, `.claude/skills/copywriting/`
- Supporting: `.claude/skills/landing-page-optimization/`, `.claude/skills/paywall-upgrade-cro/`
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/recon-safety.md` (A7)

## Dependencies
- A7, B3, E1

## Task
Update the public pricing page to surface Recon's plan inclusions and PAYG rate.

### 1. Files to modify
- `frontend/src/components/landing/PricingSection.tsx` — add a Recon row to the comparison table.
- `frontend/src/components/landing/PaygPricingSection.tsx` — add a Recon row to the PAYG rate table.

### 2. Plan-comparison row
For each plan column (free / pro_byo / pro_managed):
- **Free** — "—" (not included)
- **Pro (BYO keys)** — "1 included scan/month"
- **Pro (Managed)** — "3 included scans/month"
- Each cell links to `/docs/recon/quotas`.

### 3. PAYG row
- "Recon scan run" — "{{credits}} credits per scan" — value pulled from the `recon_scan_run` constant defined in B3.
- Tooltip explains: "Partial / cancelled scans are billed only for the phases that ran."

### 4. Banned vocabulary
Per `.claude/rules/recon-safety.md` rule #6, no Shannon / nmap / subfinder / whatweb / schemathesis / Playwright / Anthropic / Claude in any new copy.

### 5. Visual style
- Match the existing pricing table. No new colors, no gradient text. `rounded-lg` only.

### Tests
- Vitest:
  - New row renders in the comparison table with the correct values per plan.
  - New row in PAYG renders the credit count from the constant (mock the constant; verify the rendered number matches).
  - Tooltip trigger renders + opens.
  - Snapshot in en + ar.
- Playwright (`frontend/e2e/landing/pricing.spec.ts` — extend existing):
  - Recon row visible at all breakpoints.
  - Hover/click tooltip renders.
- 100% coverage on changed lines.

### i18n
Add to `frontend/public/locales/{en,ar,fr,de,es}/landing.json`:
- `landing.pricing.recon.label` — "Recon — security scans"
- `landing.pricing.recon.free`, `.proByo`, `.proManaged`
- `landing.pricing.recon.paygLabel`
- `landing.pricing.recon.tooltip` — "Partial or cancelled scans are billed only for the phases that ran."
- 5 locales.

### Documentation
- E3: link to `/docs/recon/quotas` from the comparison-table cells.

### Files to modify
- `frontend/src/components/landing/PricingSection.tsx`
- `frontend/src/components/landing/PaygPricingSection.tsx`
- 5 frontend `landing.json` locale files
- Tests

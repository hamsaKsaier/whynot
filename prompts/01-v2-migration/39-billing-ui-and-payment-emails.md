# Billing UI + payment emails (5 languages)

## Agent
`design-ui-designer` (lead) + `translation-manager` + skill `shadcn-design-system-compliance`

## Depends on
`38-validate-subscription-trial-payg.md`

## Goal
Build the user-facing billing experience: a Checkout page, a Settings > Billing tab (plan selector, trial banner, credit top-up, invoice history), and 6 transactional email templates rendered in all 5 languages.

## Single source of truth
`ARCHITECTURE.md` section 9.

## Reference
`/home/serverlessbase/serverless-v2/serverlessbase/apps/serverlessbase/pages/dashboard/settings/billing.tsx`

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Checkout page
- `frontend/src/pages/CheckoutPage.tsx`:
  - Plan selection (Free, Pro BYO, Pro Managed) reading from `shared/constants/pricing.ts`.
  - Tier explainer (BYO-keys vs Managed+PAYG) with comparison table.
  - "Start trial" CTA → calls `POST /api/me/billing/checkout`.
  - Stripe Checkout redirect.
  - Localized + dark + RTL.

### 2. Settings > Billing tab
- `frontend/src/pages/settings/tabs/BillingTab.tsx`:
  - Current plan card + tier badge.
  - Trial banner with countdown if `isWithinTrial`.
  - Credit balance card (Managed+PAYG only) + top-up dialog.
  - Invoice history table from `billing_history` (cursor pagination, Shadcn Table, currency formatting).
  - Upgrade / downgrade / cancel / reactivate buttons (gated by current state).

### 3. Email templates
- `gateway/src/emails/` with one file per template + a per-language MJML or React-Email source:
  - `payment-success`
  - `payment-failed`
  - `subscription-created`
  - `subscription-renewal-reminder`
  - `trial-ending` (3 days before)
  - `credits-low` (Managed+PAYG below threshold)
- Each rendered in all 5 languages via the gateway i18n stack.
- Subjects + bodies via `emails:*` namespace keys.

### 4. Hook emails into payment lifecycle
- `subscription-manager.ts` and `billing-service.ts` enqueue the appropriate email after every relevant state change. (Email queue plumbing: assume the project already has an outbound mail abstraction; if not, this prompt creates a minimal `gateway/src/emails/sender.ts` wrapper around a configurable transport — check repo first.)

### Files to create/modify
- `frontend/src/pages/CheckoutPage.tsx` — new
- `frontend/src/pages/settings/tabs/BillingTab.tsx` — new
- `frontend/src/router.tsx` — add `/checkout` route
- `gateway/src/emails/{payment-success,payment-failed,subscription-created,subscription-renewal-reminder,trial-ending,credits-low}.tsx` — new
- `gateway/src/emails/sender.ts` — new (only if no existing sender)
- `gateway/src/i18n/translations/{en,ar,fr,de,es}/emails.json` — populated with subject + body keys
- `frontend/public/locales/{en,ar,fr,de,es}/billing.json` — UI keys

### Tests
- Component tests (Vitest + RTL) for CheckoutPage and BillingTab.
- Email snapshot tests: render each template in each language; snapshot the HTML output.
- Playwright e2e: full flow — sign up → trial → upgrade to Pro Managed via Checkout → top up credits → assert invoice history shows the topup.
- Axe scan on CheckoutPage and BillingTab.
- Coverage: 100% on touched files.

### i18n
- All UI strings via `t('billing:*')`.
- All email strings via `req.t('emails:*')`.
- Currency formatting honors locale (e.g. fr uses `,` decimal).

### Documentation
- `docs/{en,ar,fr,de,es}/payments/billing-ui.md` — explains the user flows
- `docs/{en,ar,fr,de,es}/payments/emails.md` — documents each template

### Acceptance criteria
- [ ] CheckoutPage + BillingTab functional, accessible, localized, dark + RTL.
- [ ] All 6 email templates rendered in 5 languages and snapshot-tested.
- [ ] Email triggered on each lifecycle event.
- [ ] Currency formatting locale-correct.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.

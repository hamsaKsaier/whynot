# Validate: Billing UI + payment emails

## Agent
`design-ui-designer` (verifier) + `translation-manager`

## Depends on
`39-billing-ui-and-payment-emails.md`

## Goal
Verify CheckoutPage + BillingTab work end-to-end, all 6 email templates render correctly in all 5 languages, and lifecycle events trigger the right email.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Component tests pass; coverage 100% on touched files.

### 2. Email snapshots
- For each of 6 templates × 5 languages = 30 snapshots; all match.
- Subjects localized; placeholders interpolated correctly.

### 3. Playwright e2e
- Full flow: sign up → start trial → upgrade to Pro Managed via Checkout (Stripe Checkout stub) → land on success page → BillingTab shows new plan → top up credits → invoice history reflects topup.
- Repeat key screens in fr + ar; assert RTL on Arabic.

### 4. Email triggers
- Trigger `subscription-created` event in test → email queued with correct template + language for the user.
- Same for trial-ending, payment-success, payment-failed, credits-low, renewal-reminder.

### 5. Accessibility
- Axe scan on CheckoutPage + BillingTab → no violations.
- Lighthouse CI on CheckoutPage → a11y ≥ 95.

### 6. Currency formatting
- BillingTab in fr renders `29,00 €` (or per-locale convention). Spot check de + es.

### 7. Regression scan
- Earlier-phase suites still green.

## Pass criteria
- [ ] Email snapshots match (30 total).
- [ ] e2e flow passes.
- [ ] A11y clean.
- [ ] Locale currency correct.
- [ ] Coverage 100%.
- [ ] No regressions.

## On failure
- Re-open `39-billing-ui-and-payment-emails.md`; fix; rerun.
- Do NOT advance to phase 8 until this validation passes.

# 14 — Responsive: Billing, Plans, Invoices, Transactions

## Agent
`frontend-developer`

## Skills referenced
- `.claude/agents/design/design-ui-designer.md`
- `.claude/rules/uncodixify-ui.md`
- STYLES.md

## Task

Billing UI currently uses wide tables that overflow on mobile and lacks responsive pricing cards. Make it mobile-first.

**Routes in scope**:
- `frontend/src/components/Billing/TransactionHistory.tsx`
- `frontend/src/components/Billing/InvoiceList.tsx`
- `frontend/src/pages/BillingPage.tsx` (or similar)
- `frontend/src/pages/PlansPage.tsx`
- `frontend/src/pages/PayAsYouGoPage.tsx`
- `frontend/src/components/Billing/PlanCard.tsx`
- `frontend/src/components/Billing/UsageMeters.tsx`
- Checkout redirect flow

### Scope / Requirements

1. **Pricing cards (Plans page)**
   - `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`.
   - Popular plan: visual distinction via border + badge, not via scale-up (no `hover:scale-*`).
   - Monthly/yearly toggle: pill segmented control, ≥44px tall.
   - Price: `text-3xl font-semibold` on desktop, `text-2xl` on mobile.
   - Feature lists: checkmark icons + text, no truncation.
   - CTA button full-width on mobile.

2. **Current plan / usage summary**
   - Card with current plan, renewal date, usage meters.
   - Usage meters: horizontal bars with percentage, responsive width.
   - "Upgrade" button prominent on mobile.

3. **TransactionHistory**
   - Desktop: table with columns (date, description, amount, status, actions).
   - Mobile: card stack — each card has date header, description, amount (right-aligned), status badge, action buttons.
   - Use `md:hidden` + `hidden md:block` split, or a single component with conditional rendering.
   - Replace `text-left`/`text-right` with `text-start`/`text-end`.
   - Add `overflow-x-auto` wrapper as last-resort fallback for ultra-wide tables.

4. **InvoiceList**
   - Same treatment. Download PDF button prominent.
   - Invoice amount in bigint cents — format via `Intl.NumberFormat` respecting user locale and org currency.

5. **Checkout flow**
   - Redirect to Stripe Checkout for payment collection — no custom card form.
   - Success/cancel URLs from `.env` (`STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`).
   - Return page shows confirmation message localized in all 5 languages.

6. **PAYG page**
   - Usage-based billing: clear rate card.
   - Estimated cost calculator: sliders + inputs, responsive.
   - Auto-recharge settings: toggle + threshold input.

7. **Touch targets, dark mode, RTL, logical properties, uncodixify compliance**.

### Tests (MANDATORY — 100% coverage)
- **Responsive snapshots** at 7 viewports.
- **Table↔card responsive switch**: assert table hidden below `md`, cards above; inverse above `md`.
- **Pricing toggle**: e2e switches monthly/yearly and asserts price updates.
- **Checkout link**: e2e clicks Subscribe, asserts redirect to Stripe test checkout URL.
- **Currency formatting**: test multiple locales (`en-US`, `fr-FR`, `ar-SA`, `de-DE`, `es-ES`) and currencies (USD, EUR, SAR) — verify bigint cents → formatted string.
- **Invoice download**: e2e downloads a PDF and asserts it's a valid PDF (magic bytes).
- **i18n**: all 5 languages, no overflow.
- **a11y/contrast**: pass in light and dark modes.

### i18n (5 languages)
- Keys under `billing.*`, `billing.plans.*`, `billing.invoices.*`, `billing.transactions.*`, `billing.payg.*` from prompt 01.
- Backend billing error messages from prompt 06 (`errors.billing.*`).
- Email receipts/invoices in user's locale via `gateway/src/i18n/translations/{lang}/emails.json`.

### Documentation
- `/docs/en/user-guide/billing/plans.md`, `invoices.md`, `transactions.md`, `pay-as-you-go.md`.
- 5-language variants.

### Constraints
- Docker-only.
- bigint cents for money — never use floats.
- Stripe Checkout for payment collection; never store card data.
- Uncodixify compliance.
- No new dependencies.

### Verification steps
1. `make shell-client npm run typecheck && npm run lint && npm test`
2. `make shell-client npm run test:responsive -- billing`
3. `make start` → run a full billing flow at 320px and 1280px in all 5 languages: view plans, click subscribe (Stripe test mode), complete, return to app, see new plan active.
4. Verify transactions and invoices render correctly in card form on mobile, table on desktop.

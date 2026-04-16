# 19 — Payments: Stripe End-to-End Validation

## Agent
`api-designer`

## Skills referenced
- `.claude/skills/backend-i18n/`
- `.claude/skills/spec-driven-development/`

## Task

`gateway/src/payments/` contains 11 files claiming a complete Stripe integration: `payment-service.ts` (32KB), `stripe-provider.ts`, `subscription-manager.ts`, `billing-service.ts`, webhook handler at `gateway/src/api/webhooks/stripe.ts`, retry engine, idempotency, audit logger, credit cost mapper, error handling, types.

Prompts 33-40 in `prompts/01-v2-migration/` marked this `_done`, but it has never been validated end-to-end against real Stripe test mode. This prompt runs the full flow and fixes anything that breaks.

### Scope / Requirements

1. **Test mode setup**
   - Document required Stripe dashboard setup inside the prompt (also reproduced in prompt 21's README docs):
     - Create a Stripe account (or use test mode on an existing one).
     - Create products in test mode: `whynot Starter`, `whynot Pro`, `whynot Business`, `whynot Enterprise`, `PAYG` metered price.
     - Create prices for each product (monthly, yearly where applicable).
     - Copy price IDs (`price_...`) into `.env`: `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_YEARLY`, etc.
     - Create a webhook endpoint pointing to `https://superadmin.whynot.skrum.io/api/webhooks/stripe` (or localhost during dev).
     - Copy webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
     - Copy secret key into `STRIPE_SECRET_KEY`, publishable key into `STRIPE_PUBLISHABLE_KEY`.
   - For local dev: `stripe listen --forward-to localhost:3010/api/webhooks/stripe` — the Stripe CLI prints a signing secret to use locally.

2. **E2E flow to validate**
   - **Signup → Trial**: user signs up, `subscription-manager.ts` starts a trial. Verify trial end date.
   - **Trial → Paid**: user clicks "Upgrade", `createCheckoutSession()` redirects to Stripe Checkout. Complete with test card `4242 4242 4242 4242`. Webhook fires `checkout.session.completed` and `customer.subscription.created`. Verify subscription row created and user's plan updated.
   - **Renewal**: fast-forward Stripe test clocks (or manually trigger `invoice.paid`). Verify renewal extends.
   - **Cancel**: user cancels subscription. Webhook fires `customer.subscription.updated` with `cancel_at_period_end: true`. Verify DB reflects cancellation at period end.
   - **Reactivate**: user re-subscribes. Verify lifecycle.
   - **PAYG charge**: user consumes metered usage; `chargePayg()` creates a PaymentIntent; charge succeeds. Verify audit log entry.
   - **Refund**: admin issues refund via `refund()`; `charge.refunded` webhook fires; user balance updated.
   - **Failed payment**: use Stripe test card `4000 0000 0000 0341` (decline after attach). Verify `invoice.payment_failed` webhook is handled and user notified via email in their locale.
   - **Dispute**: Stripe CLI `stripe trigger charge.dispute.created`. Verify handler logs and notifies.

3. **Idempotency**
   - Replay the same webhook payload twice (via `stripe trigger --repeat`). Verify the second delivery is acknowledged but doesn't duplicate DB rows — `payment_webhooks_idempotency` table enforces uniqueness on event ID.
   - Replay `createCheckoutSession` with the same idempotency key — Stripe returns the same session.

4. **Error path localization**
   - Every user-visible payment error goes through `req.t('errors:billing.*')` (coordinate with prompt 06).
   - Specific keys to ensure exist in all 5 languages:
     - `errors.billing.cardDeclined`
     - `errors.billing.insufficientFunds`
     - `errors.billing.expiredCard`
     - `errors.billing.invalidCard`
     - `errors.billing.authenticationRequired` (3DS)
     - `errors.billing.subscriptionNotFound`
     - `errors.billing.planNotFound`
     - `errors.billing.webhookSignatureInvalid`
     - `errors.billing.refundFailed`
     - `errors.billing.paygLimitExceeded`
   - Success keys similarly: `success.billing.subscriptionCreated`, `success.billing.subscriptionCanceled`, `success.billing.refundIssued`, `success.billing.paygCharged`.

5. **Audit log**
   - Every payment event (checkout, subscription change, refund, webhook) logs to the audit trail with actor, action, target, amount (bigint cents), currency, timestamp.
   - Admin audit log page (prompt 17) renders these entries correctly.

6. **Admin billing pages**
   - Verify `admin-frontend/src/pages/PlansPage.tsx`, `SubscriptionsPage.tsx`, `CreditsPage.tsx`, `BillingConfigPage.tsx` all work against real Stripe test data.
   - Editing a plan in the admin creates/updates the Stripe product+price via the API.

7. **Email notifications**
   - Payment receipts, failed payment alerts, cancellation confirmations, refund notices sent via `gateway/src/services/email/*`.
   - All template strings use `gateway/src/i18n/translations/{lang}/emails.json` in the user's locale.
   - Test with mock SMTP (`mailhog` container in docker-compose.test.yml).

### Tests (MANDATORY — 100% coverage)
- **Unit**: every method in `payment-service.ts`, `stripe-provider.ts`, `subscription-manager.ts`, `billing-service.ts` tested with mocked Stripe SDK.
- **Integration**: full E2E suite in `gateway/src/__tests__/payments-e2e.test.ts` hitting a mocked Stripe API server (e.g., `stripe-mock`) — covers every flow listed above.
- **Webhook idempotency**: replay test asserts single-effect semantics.
- **i18n**: every error path fires `req.t('errors:billing.*')` with 5 language assertions.
- **Audit log**: every write to audit table validated.
- **Email**: snapshot email HTML for each template in each language; assert locale-correct content.
- **Edge cases**: partial refund, failed 3DS, network timeout during checkout, concurrent webhook deliveries, missing `STRIPE_WEBHOOK_SECRET`, invalid signature, clock skew.
- **Load**: 100 concurrent webhook deliveries, assert all processed without duplication.

### i18n (5 languages)
- Scope: all backend payment responses and email templates, in en/ar/fr/de/es.
- Keys added/updated in `gateway/src/i18n/translations/{lang}/{errors,success,emails,billing}.json`.
- Frontend billing keys (button labels, modal copy) stay under `frontend/public/locales/{lang}/billing.json` (owned by prompts 01-05).

### Documentation
- `/docs/en/payments/stripe-setup.md` — full walkthrough for developers and admins:
  - Stripe account setup
  - Creating products and prices
  - Configuring webhooks
  - Copying keys into `.env`
  - Running `stripe listen` for local dev
  - Test card numbers reference
  - Going live (production keys, production webhook)
- `/docs/en/payments/troubleshooting.md` — common issues (webhook not firing, signature invalid, card declined, etc).
- 5-language variants for both docs.
- Linked from README.md via prompt 21.

### Constraints
- Docker-only: `make shell-gateway`.
- bigint cents for money throughout — never use floats or string dollars.
- Org-scoped access: a user can only see their own org's payment data.
- Webhook handler must validate signature against `STRIPE_WEBHOOK_SECRET` — fail with 400 on mismatch.
- Idempotency enforced via `payment_webhooks_idempotency` table unique constraint on `stripe_event_id`.
- Never log Stripe secret keys, webhook secrets, or card data. Audit log redacts sensitive fields.
- ISO 8601 dates in API responses; camelCase response bodies.

### Verification steps
1. `make shell-gateway npm run typecheck && npm run lint && npm test -- payments`
2. `make shell-gateway npm test -- payments-e2e` (against `stripe-mock` or real test mode)
3. `make start` → run the full flow manually:
   - Sign up as a new user, start trial
   - Upgrade to Pro via Stripe Checkout test mode (`4242 4242 4242 4242`)
   - Verify subscription row in DB
   - Cancel, reactivate, cancel again
   - Trigger PAYG usage, verify charge
   - Refund via admin UI
   - Test failed card (`4000 0000 0000 0341`)
4. `stripe listen --forward-to localhost:3010/api/webhooks/stripe` running in parallel — verify every webhook event is acknowledged.
5. Switch user locale to each of ar/fr/de/es and repeat one flow per language — verify email receipts and error messages render localized.

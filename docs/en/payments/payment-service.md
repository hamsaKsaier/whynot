# Payment Service

The `PaymentService` class (`gateway/src/payments/payment-service.ts`) is the single entry point for all payment operations in whynot. All business logic calls `PaymentService` — never the Stripe provider directly.

## Public API

### `createCheckoutSession(params, ctx)`
Creates a Stripe Checkout session for subscribing to a plan.

- **params**: `{ orgId, plan, tier, successUrl, cancelUrl }`
- **returns**: `{ sessionId, url, idempotencyKey }`

### `createSubscription(params, ctx)`
Creates a subscription in the local database and Stripe.

- **params**: `{ orgId, plan, tier }`
- **returns**: `{ subscriptionId, stripeSubscriptionId, status }`

### `handleWebhook(event)`
Dispatches Stripe webhook events (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`).

### `refund(params, ctx)`
Processes a refund via Stripe.

- **params**: `{ paymentIntentId, amountCents? }` — `amountCents` is `bigint`; omit for full refund
- **returns**: `{ refundId, amountCents, status }`

### `chargePayg(params, ctx)`
Charges a PAYG (pay-as-you-go) amount. Writes a `payg_credits_ledger` row and creates a Stripe PaymentIntent.

- **params**: `{ orgId, amountCents, reason, relatedEventId? }` — `amountCents` is `bigint`
- **returns**: `{ ledgerEntryId, paymentIntentId, amountCents }`

## The Bigint Rule

All money values are `bigint` cents. Never use `number` or `float` for monetary arithmetic. The Stripe SDK returns `number` — convert to `bigint` immediately at the provider boundary.

```typescript
// Correct
const total = BigInt(plan.price_cents) * BigInt(quantity);

// Wrong — float drift
const total = plan.price_cents * quantity;
```

## Retry + Idempotency

- **Retry**: Exponential backoff, max 3 attempts. Only retries transient errors (5xx, network). Never retries 4xx (card declined, invalid request).
- **Idempotency**: UUID v4 keys generated per create operation and forwarded to Stripe. Cached results returned for duplicate keys within 24h.

## Audit Logging

Every public method writes to `payment_audit_log`. Logged fields: operation, provider, status, duration, amount (cents), currency, retry count, provider refs. **Never logged**: card numbers, CVV, email, name, phone, address.

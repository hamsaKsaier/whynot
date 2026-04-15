# Stripe Setup Guide

Complete walkthrough for configuring Stripe payments in WhyNot QA.

## Prerequisites

- A Stripe account ([stripe.com](https://stripe.com))
- Stripe CLI installed ([stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli))
- WhyNot platform running via Docker (`make start`)

## 1. Stripe Dashboard Setup

### Enable Test Mode

1. Log in to the Stripe Dashboard.
2. Toggle **Test mode** in the top-right corner.
3. All subsequent steps use test mode data.

### Create Products

Create the following products in **Products > + Add product**:

| Product Name | Pricing Model |
|---|---|
| WhyNot Starter | Recurring (monthly + yearly) |
| WhyNot Pro | Recurring (monthly + yearly) |
| WhyNot Business | Recurring (monthly + yearly) |
| WhyNot Enterprise | Recurring (monthly + yearly) |
| PAYG | Metered usage |

For each recurring product, create two prices (monthly and yearly). For PAYG, create a single metered price.

### Copy Price IDs

After creating products, copy each `price_...` ID into your `.env` file:

```bash
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
STRIPE_PRICE_PAYG_METERED=price_...
```

## 2. API Keys

1. Go to **Developers > API keys**.
2. Copy the **Secret key** (`sk_test_...`) into `STRIPE_SECRET_KEY`.
3. Copy the **Publishable key** (`pk_test_...`) into `STRIPE_PUBLISHABLE_KEY`.

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 3. Webhook Configuration

### Production / Staging

1. Go to **Developers > Webhooks > + Add endpoint**.
2. Set the URL to: `https://superadmin.whynot.skrum.io/api/webhooks/stripe`
3. Select events to listen for:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `charge.dispute.created`
4. Copy the **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

### Local Development

Use the Stripe CLI to forward webhooks to your local gateway:

```bash
stripe listen --forward-to localhost:3010/api/webhooks/stripe
```

The CLI prints a webhook signing secret on startup. Copy it:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...  # from stripe listen output
```

Keep `stripe listen` running in a separate terminal while developing.

## 4. Environment Variables Summary

```bash
# .env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
STRIPE_PRICE_PAYG_METERED=price_...

STRIPE_SUCCESS_URL=http://localhost:5183/billing?success=true
STRIPE_CANCEL_URL=http://localhost:5183/billing?canceled=true
```

## 5. Test Card Numbers

| Card Number | Scenario |
|---|---|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 3220` | 3D Secure authentication required |
| `4000 0000 0000 0341` | Attaches successfully, fails on charge |
| `4000 0000 0000 9995` | Insufficient funds decline |
| `4000 0000 0000 0069` | Expired card decline |
| `4000 0000 0000 0127` | Incorrect CVC decline |
| `4000 0000 0000 0002` | Generic decline |

Use any future expiration date (e.g., `12/34`), any 3-digit CVC, and any postal code.

## 6. Testing the Full Flow

1. **Start the platform**: `make start`
2. **Start Stripe listener**: `stripe listen --forward-to localhost:3010/api/webhooks/stripe`
3. **Sign up** as a new user at `http://localhost:5183`
4. **Start trial**: The system auto-provisions a trial subscription.
5. **Upgrade**: Click "Upgrade" and use test card `4242 4242 4242 4242`.
6. **Verify**: Check the subscription row in the database and the Stripe Dashboard.
7. **Cancel**: Cancel from the billing page. Verify `cancel_at_period_end`.
8. **Reactivate**: Reactivate before period end.
9. **Test failure**: Use card `4000 0000 0000 0341` to trigger `invoice.payment_failed`.
10. **Refund**: Issue a refund from the admin UI.

## 7. Going Live (Production)

1. Complete Stripe's activation checklist in the Dashboard.
2. Toggle off Test mode.
3. Create production products and prices (same structure as test).
4. Update `.env` with live keys (`sk_live_...`, `pk_live_...`).
5. Create a production webhook endpoint with the same events.
6. Update `STRIPE_WEBHOOK_SECRET` with the production signing secret.
7. Update `STRIPE_SUCCESS_URL` and `STRIPE_CANCEL_URL` to production URLs.

**Never commit live Stripe keys to version control.**

## 8. Admin Billing Pages

The admin panel at `http://localhost:5184` provides:

- **Plans**: Create, edit, archive, and sync plans to Stripe.
- **Subscriptions**: View all workspace subscriptions with status filters.
- **Credits**: Grant manual credits and export credit data.
- **Billing Config**: Configure trial days, grace period, PAYG rates.

Editing a plan in the admin UI automatically creates or updates the corresponding Stripe product and price via the API.

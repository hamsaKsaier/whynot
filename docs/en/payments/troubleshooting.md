# Payment Troubleshooting Guide

Common issues and solutions for WhyNot QA's Stripe payment integration.

## Webhook Issues

### Webhooks not firing

**Symptoms**: Subscription status not updating after checkout, invoices not recorded.

**Solutions**:
1. Verify `stripe listen` is running (local dev):
   ```bash
   stripe listen --forward-to localhost:3010/api/webhooks/stripe
   ```
2. Check the Stripe Dashboard under **Developers > Webhooks** for failed deliveries.
3. Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret from `stripe listen` or the Dashboard.
4. Ensure the gateway container is running: `docker ps | grep gateway`.

### Signature verification failed (400)

**Symptoms**: Webhook returns `400 Signature verification failed`.

**Causes**:
- `STRIPE_WEBHOOK_SECRET` is incorrect or from a different endpoint.
- The raw request body was parsed before reaching the webhook handler (body must arrive as raw buffer).
- Clock skew between your server and Stripe (signature has a timestamp tolerance of ~5 minutes).

**Solutions**:
1. Regenerate the webhook signing secret in the Stripe Dashboard.
2. For local dev, restart `stripe listen` and copy the new secret.
3. Verify your reverse proxy is not modifying the request body.

### Duplicate webhook deliveries

**Symptoms**: Stripe retries webhooks multiple times.

**Explanation**: Stripe retries if it doesn't receive a `2xx` response within 20 seconds. The idempotency table (`payment_webhooks_idempotency`) prevents duplicate processing. If you see retries in the Stripe Dashboard, check:
1. Gateway logs for errors during webhook handling.
2. Database connectivity (the idempotency INSERT must succeed).
3. Response time (handler must respond within 20 seconds).

## Card Declines

### Generic card decline

**Error**: `billing.cardDeclined`

The card was declined by the issuing bank. Ask the customer to:
- Try a different card.
- Contact their bank to authorize the charge.
- Check for any fraud prevention blocks.

### Insufficient funds

**Error**: `billing.insufficientFunds`

The card doesn't have enough balance. Ask the customer to use a different card or add funds.

### Expired card

**Error**: `billing.expiredCard`

The card's expiration date has passed. Ask the customer to update their payment method.

### 3D Secure authentication required

**Error**: `billing.authenticationRequired`

The card requires additional authentication (3DS/SCA). The customer must complete the authentication flow in their browser. This is common for European cards under PSD2/SCA regulations.

## Subscription Issues

### Subscription not found after checkout

**Cause**: The `checkout.session.completed` webhook hasn't been processed yet.

**Solutions**:
1. Check if the webhook was received (Stripe Dashboard > Webhooks > Recent events).
2. Verify the idempotency table has the event ID.
3. Check gateway logs for errors during `handleCheckoutCompleted`.

### Trial not starting

**Cause**: The `provisionNewWorkspace` method wasn't called or the billing config `trial_days` is set to 0.

**Solutions**:
1. Check `billing_config` table for `trial_days` value.
2. Verify workspace creation triggers subscription provisioning.

### Subscription stuck in `past_due`

**Cause**: An invoice payment failed and hasn't been retried successfully.

**Solutions**:
1. Customer updates their payment method via the billing portal.
2. Admin manually retries the invoice in the Stripe Dashboard.
3. Stripe automatically retries according to the retry schedule (configured in Stripe Dashboard > Settings > Billing > Subscriptions > Retry schedule).

## PAYG Issues

### PAYG charge failed

**Cause**: The stored payment method was declined when auto-charging a negative PAYG balance.

**Solutions**:
1. Customer adds a valid payment method.
2. Admin tops up the workspace balance manually via the Credits page.
3. Check the `payg_credits_ledger` table for the failed entry.

### Credits not deducted

**Cause**: The `credit-gate` middleware may not be applied to the route, or `deductCredits` is not called after the operation.

**Solutions**:
1. Verify the route uses `requireCredits()` middleware.
2. Verify `deductCredits()` is called in the route handler after success.

## Refund Issues

### Refund failed

**Error**: `billing.refundFailed`

**Causes**:
- The charge is too old (Stripe allows refunds within 180 days).
- The charge was already fully refunded.
- The Stripe account balance is insufficient for the refund.

**Solutions**:
1. Check the charge in the Stripe Dashboard.
2. For partial refunds, verify the remaining refundable amount.
3. Contact Stripe support if the refund is blocked.

## Environment Issues

### Missing Stripe keys

**Symptoms**: `Error: Stripe secret key not configured`

**Solution**: Ensure all required environment variables are set in `.env`:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Wrong environment (test vs live)

**Symptoms**: API calls fail with authentication errors, or charges appear on real cards.

**Solution**: Verify you're using the correct key prefix:
- Test mode: `sk_test_...`, `pk_test_...`
- Live mode: `sk_live_...`, `pk_live_...`

Never mix test and live keys.

## Database Issues

### Idempotency table missing

**Symptoms**: `500 Internal error` on webhook endpoint.

**Solution**: Run database migrations:
```bash
make shell-gateway npm run migrate
```

### Subscription row not created

**Cause**: The `workspace_subscriptions` table insert failed.

**Solutions**:
1. Check gateway logs for SQL errors.
2. Verify the workspace ID exists in the `workspaces` table.
3. Check for unique constraint violations (duplicate subscription).

## Debugging Tips

1. **Stripe Dashboard**: Always check **Developers > Events** for the complete event log.
2. **Gateway logs**: `docker logs whynot-gateway-1 --tail 100 -f`
3. **Stripe CLI events**: `stripe events list --limit 10`
4. **Test webhooks manually**: `stripe trigger checkout.session.completed`
5. **Check idempotency**: Query `payment_webhooks_idempotency` table for event processing status.
6. **Audit log**: Query `payment_audit_log` table for payment operation history.

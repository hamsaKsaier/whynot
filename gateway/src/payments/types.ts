export type PaymentProvider = 'stripe';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'trialing'
  | 'unpaid'
  | 'paused';

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled'
  | 'failed';

export type WebhookEventType =
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed';

export interface CheckoutSessionParams {
  orgId: string;
  plan: string;
  tier: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateSubscriptionParams {
  orgId: string;
  plan: string;
  tier: string;
}

export interface RefundParams {
  paymentIntentId: string;
  amountCents?: bigint;
}

export interface ChargePaygParams {
  orgId: string;
  amountCents: bigint;
  reason: string;
  relatedEventId?: string;
}

export interface CheckoutResult {
  sessionId: string;
  url: string;
  idempotencyKey: string;
}

export interface SubscriptionResult {
  subscriptionId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
}

export interface RefundResult {
  refundId: string;
  amountCents: bigint;
  status: 'pending' | 'succeeded' | 'failed';
}

export interface PaygChargeResult {
  ledgerEntryId: string;
  paymentIntentId: string;
  amountCents: bigint;
}

export interface PaymentServiceContext {
  userId: string;
  orgId: string;
  idempotencyKey?: string;
}

export interface AuditEntry {
  operation: string;
  provider: PaymentProvider;
  status: 'success' | 'failed' | 'requires_action';
  durationMs: number;
  userId?: string;
  orgId?: string;
  idempotencyKey?: string;
  amountCents?: bigint;
  currency?: string;
  errorMessage?: string;
  errorCode?: string;
  retryAttempts?: number;
  providerRefs?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface PaymentTransactionRecord {
  id: string;
  workspace_id: string;
  provider: PaymentProvider;
  provider_transaction_id: string;
  type: 'subscription' | 'one_time' | 'refund' | 'payg';
  status: 'completed' | 'failed' | 'pending';
  amount_cents: bigint;
  currency: string;
  failure_code: string | null;
  failure_message: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface PaygLedgerEntry {
  id: string;
  workspace_id: string;
  amount_cents: bigint;
  reason: string;
  related_event_id: string | null;
  stripe_payment_intent_id: string | null;
  status: 'pending' | 'completed' | 'failed';
  created_at: Date;
}

export interface BillingConfigEntry {
  key: string;
  value: string;
  updated_at: Date;
}

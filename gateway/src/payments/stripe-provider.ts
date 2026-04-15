import Stripe from 'stripe';
import { createLogger } from '../../shared/logger/logger';
import { PaymentServiceError } from './payment-error';
import { withRetry } from './retry-engine';
import { generateIdempotencyKey } from './idempotency';

const logger = createLogger('stripe-provider');

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new PaymentServiceError({
        code: 'PROVIDER_ERROR',
        message: 'STRIPE_SECRET_KEY is not configured',
        provider: 'stripe',
        retryable: false,
      });
    }
    stripeInstance = new Stripe(secretKey, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion });
  }
  return stripeInstance;
}

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new PaymentServiceError({
      code: 'PROVIDER_ERROR',
      message: 'STRIPE_WEBHOOK_SECRET is not configured',
      provider: 'stripe',
      retryable: false,
    });
  }
  return secret;
}

function assertSafeAmount(cents: bigint): void {
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new PaymentServiceError({
      code: 'INVALID_REQUEST',
      message: `Amount ${cents} exceeds MAX_SAFE_INTEGER; cannot safely convert to Number for Stripe API`,
      provider: 'stripe',
      retryable: false,
    });
  }
}

export class StripeProvider {
  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
    trialPeriodDays?: number;
    idempotencyKey?: string;
  }): Promise<{ sessionId: string; url: string }> {
    const stripe = getStripe();
    const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKey();

    const { result } = await withRetry(
      () =>
        stripe.checkout.sessions.create(
          {
            customer: params.customerId,
            mode: 'subscription',
            line_items: [{ price: params.priceId, quantity: 1 }],
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
            metadata: params.metadata,
            subscription_data: {
              metadata: params.metadata,
              trial_period_days: params.trialPeriodDays,
            },
          },
          { idempotencyKey },
        ),
      'createCheckoutSession',
    );

    return { sessionId: result.id, url: result.url! };
  }

  async createSubscription(params: {
    customerId: string;
    priceId: string;
    metadata: Record<string, string>;
    trialPeriodDays?: number;
    idempotencyKey?: string;
  }): Promise<{ subscriptionId: string; status: string; stripeSubscriptionId: string }> {
    const stripe = getStripe();
    const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKey();

    const { result } = await withRetry(
      () =>
        stripe.subscriptions.create(
          {
            customer: params.customerId,
            items: [{ price: params.priceId }],
            metadata: params.metadata,
            trial_period_days: params.trialPeriodDays,
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
          },
          { idempotencyKey },
        ),
      'createSubscription',
    );

    return {
      subscriptionId: result.id,
      status: result.status,
      stripeSubscriptionId: result.id,
    };
  }

  async cancelSubscription(stripeSubscriptionId: string, immediate: boolean): Promise<void> {
    const stripe = getStripe();

    const { result: _result } = await withRetry(async () => {
      if (immediate) {
        return stripe.subscriptions.cancel(stripeSubscriptionId);
      }
      return stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }, 'cancelSubscription');
  }

  async reactivateSubscription(stripeSubscriptionId: string): Promise<void> {
    const stripe = getStripe();

    await withRetry(
      () =>
        stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: false,
        }),
      'reactivateSubscription',
    );
  }

  async createPaymentIntent(params: {
    amountCents: bigint;
    currency: string;
    customerId: string;
    metadata: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<{ paymentIntentId: string; clientSecret: string; status: string }> {
    const stripe = getStripe();
    const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKey();
    assertSafeAmount(params.amountCents);

    const { result } = await withRetry(
      () =>
        stripe.paymentIntents.create(
          {
            amount: Number(params.amountCents),
            currency: params.currency,
            customer: params.customerId,
            metadata: params.metadata,
            automatic_payment_methods: { enabled: true },
          },
          { idempotencyKey },
        ),
      'createPaymentIntent',
    );

    return {
      paymentIntentId: result.id,
      clientSecret: result.client_secret!,
      status: result.status,
    };
  }

  async createRefund(params: {
    paymentIntentId: string;
    amountCents?: bigint;
    idempotencyKey?: string;
  }): Promise<{ refundId: string; amountCents: bigint; status: string }> {
    const stripe = getStripe();
    const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKey();
    if (params.amountCents != null) assertSafeAmount(params.amountCents);

    const { result } = await withRetry(
      () =>
        stripe.refunds.create(
          {
            payment_intent: params.paymentIntentId,
            amount: params.amountCents != null ? Number(params.amountCents) : undefined,
          },
          { idempotencyKey },
        ),
      'createRefund',
    );

    return {
      refundId: result.id,
      amountCents: BigInt(result.amount),
      status: result.status ?? 'pending',
    };
  }

  async getOrCreateCustomer(params: {
    email: string;
    name: string;
    metadata: Record<string, string>;
    existingCustomerId?: string;
  }): Promise<string> {
    const stripe = getStripe();

    if (params.existingCustomerId) {
      try {
        const { result: customer } = await withRetry(
          () => stripe.customers.retrieve(params.existingCustomerId!),
          'retrieveCustomer',
        );
        if (!('deleted' in customer) || !customer.deleted) {
          return customer.id;
        }
      } catch {
        logger.warn('Existing Stripe customer not found, creating new one');
      }
    }

    const { result: customer } = await withRetry(
      () =>
        stripe.customers.create({
          email: params.email,
          name: params.name,
          metadata: params.metadata,
        }),
      'createCustomer',
    );

    return customer.id;
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const stripe = getStripe();

    const { result } = await withRetry(
      () =>
        stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        }),
      'createPortalSession',
    );

    return { url: result.url };
  }

  async syncPlanToStripe(plan: {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    priceCents: number;
    billingInterval: string;
    stripeProductId: string | null;
  }): Promise<{ productId: string; priceId: string }> {
    const stripe = getStripe();

    let productId = plan.stripeProductId ?? undefined;

    if (productId) {
      await withRetry(
        () =>
          stripe.products.update(productId!, {
            name: plan.name,
            description: plan.description ?? undefined,
          }),
        'updateProduct',
      );
    } else {
      const { result: product } = await withRetry(
        () =>
          stripe.products.create({
            name: plan.name,
            description: plan.description ?? undefined,
            metadata: { plan_id: plan.id, plan_slug: plan.slug },
          }),
        'createProduct',
      );
      productId = product.id;
    }

    const interval = plan.billingInterval === 'yearly' ? 'year' as const : 'month' as const;
    const { result: price } = await withRetry(
      () =>
        stripe.prices.create({
          product: productId!,
          unit_amount: plan.priceCents,
          currency: 'usd',
          recurring: { interval },
          metadata: { plan_id: plan.id },
        }),
      'createPrice',
    );

    return { productId: productId!, priceId: price.id };
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    const stripe = getStripe();
    const secret = getWebhookSecret();
    return stripe.webhooks.constructEvent(payload, signature, secret);
  }
}

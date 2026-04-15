import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentServiceError } from '../../payments/payment-error';

// Mock Stripe constructor
const {
  mockCheckoutCreate, mockSubscriptionsCreate, mockSubscriptionsCancel,
  mockSubscriptionsUpdate, mockPaymentIntentsCreate, mockRefundsCreate,
  mockCustomersCreate, mockCustomersRetrieve, mockPortalSessionsCreate,
  mockProductsCreate, mockProductsUpdate, mockPricesCreate, mockWebhooksConstructEvent,
} = vi.hoisted(() => ({
  mockCheckoutCreate: vi.fn(),
  mockSubscriptionsCreate: vi.fn(),
  mockSubscriptionsCancel: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
  mockPaymentIntentsCreate: vi.fn(),
  mockRefundsCreate: vi.fn(),
  mockCustomersCreate: vi.fn(),
  mockCustomersRetrieve: vi.fn(),
  mockPortalSessionsCreate: vi.fn(),
  mockProductsCreate: vi.fn(),
  mockProductsUpdate: vi.fn(),
  mockPricesCreate: vi.fn(),
  mockWebhooksConstructEvent: vi.fn(),
}));

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: { sessions: { create: mockCheckoutCreate } },
      subscriptions: {
        create: mockSubscriptionsCreate,
        cancel: mockSubscriptionsCancel,
        update: mockSubscriptionsUpdate,
      },
      paymentIntents: { create: mockPaymentIntentsCreate },
      refunds: { create: mockRefundsCreate },
      customers: { create: mockCustomersCreate, retrieve: mockCustomersRetrieve },
      billingPortal: { sessions: { create: mockPortalSessionsCreate } },
      products: { create: mockProductsCreate, update: mockProductsUpdate },
      prices: { create: mockPricesCreate },
      webhooks: { constructEvent: mockWebhooksConstructEvent },
    })),
  };
});

vi.mock('../../payments/retry-engine', () => ({
  withRetry: vi.fn(async (fn: Function) => {
    const result = await fn();
    return { result, attempts: 1, totalDurationMs: 10 };
  }),
}));

vi.mock('../../payments/idempotency', () => ({
  generateIdempotencyKey: vi.fn(() => 'idem-key-1'),
}));

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { StripeProvider } from '../../payments/stripe-provider';

describe('StripeProvider', () => {
  let provider: StripeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
    provider = new StripeProvider();
  });

  describe('createCheckoutSession', () => {
    it('creates a checkout session and returns id + url', async () => {
      mockCheckoutCreate.mockResolvedValue({ id: 'cs_123', url: 'https://checkout.stripe.com/cs_123' });

      const result = await provider.createCheckoutSession({
        customerId: 'cus_1',
        priceId: 'price_1',
        successUrl: 'https://app.test/success',
        cancelUrl: 'https://app.test/cancel',
        metadata: { org_id: 'org-1' },
      });

      expect(result.sessionId).toBe('cs_123');
      expect(result.url).toBe('https://checkout.stripe.com/cs_123');
    });
  });

  describe('createSubscription', () => {
    it('creates a subscription and returns id, status, stripeSubscriptionId', async () => {
      mockSubscriptionsCreate.mockResolvedValue({ id: 'sub_1', status: 'active' });

      const result = await provider.createSubscription({
        customerId: 'cus_1',
        priceId: 'price_1',
        metadata: { org_id: 'org-1' },
      });

      expect(result.subscriptionId).toBe('sub_1');
      expect(result.status).toBe('active');
      expect(result.stripeSubscriptionId).toBe('sub_1');
    });
  });

  describe('cancelSubscription', () => {
    it('cancels immediately when immediate is true', async () => {
      mockSubscriptionsCancel.mockResolvedValue({});

      await provider.cancelSubscription('sub_1', true);
      expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_1');
    });

    it('cancels at period end when immediate is false', async () => {
      mockSubscriptionsUpdate.mockResolvedValue({});

      await provider.cancelSubscription('sub_1', false);
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true });
    });
  });

  describe('reactivateSubscription', () => {
    it('sets cancel_at_period_end to false', async () => {
      mockSubscriptionsUpdate.mockResolvedValue({});

      await provider.reactivateSubscription('sub_1');
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: false });
    });
  });

  describe('createPaymentIntent', () => {
    it('creates a payment intent', async () => {
      mockPaymentIntentsCreate.mockResolvedValue({
        id: 'pi_1',
        client_secret: 'pi_1_secret',
        status: 'requires_payment_method',
      });

      const result = await provider.createPaymentIntent({
        amountCents: BigInt(2999),
        currency: 'usd',
        customerId: 'cus_1',
        metadata: { org_id: 'org-1' },
      });

      expect(result.paymentIntentId).toBe('pi_1');
      expect(result.clientSecret).toBe('pi_1_secret');
      expect(result.status).toBe('requires_payment_method');
    });

    it('throws for unsafe bigint amounts', async () => {
      await expect(
        provider.createPaymentIntent({
          amountCents: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1),
          currency: 'usd',
          customerId: 'cus_1',
          metadata: {},
        }),
      ).rejects.toThrow(/MAX_SAFE_INTEGER/);
    });
  });

  describe('createRefund', () => {
    it('creates a refund and returns result', async () => {
      mockRefundsCreate.mockResolvedValue({ id: 're_1', amount: 1000, status: 'succeeded' });

      const result = await provider.createRefund({
        paymentIntentId: 'pi_1',
        amountCents: BigInt(1000),
      });

      expect(result.refundId).toBe('re_1');
      expect(result.amountCents).toBe(BigInt(1000));
      expect(result.status).toBe('succeeded');
    });

    it('creates full refund when amountCents not specified', async () => {
      mockRefundsCreate.mockResolvedValue({ id: 're_2', amount: 5000, status: 'pending' });

      const result = await provider.createRefund({ paymentIntentId: 'pi_1' });

      expect(result.refundId).toBe('re_2');
      expect(result.amountCents).toBe(BigInt(5000));
    });
  });

  describe('getOrCreateCustomer', () => {
    it('returns existing customer id', async () => {
      mockCustomersRetrieve.mockResolvedValue({ id: 'cus_existing' });

      const id = await provider.getOrCreateCustomer({
        email: 'test@test.com',
        name: 'Test',
        metadata: {},
        existingCustomerId: 'cus_existing',
      });

      expect(id).toBe('cus_existing');
    });

    it('creates new customer when existing one is deleted', async () => {
      mockCustomersRetrieve.mockResolvedValue({ id: 'cus_old', deleted: true });
      mockCustomersCreate.mockResolvedValue({ id: 'cus_new' });

      const id = await provider.getOrCreateCustomer({
        email: 'test@test.com',
        name: 'Test',
        metadata: {},
        existingCustomerId: 'cus_old',
      });

      expect(id).toBe('cus_new');
    });

    it('creates new customer when no existing id', async () => {
      mockCustomersCreate.mockResolvedValue({ id: 'cus_new' });

      const id = await provider.getOrCreateCustomer({
        email: 'test@test.com',
        name: 'Test User',
        metadata: { org_id: 'org-1' },
      });

      expect(id).toBe('cus_new');
    });
  });

  describe('createPortalSession', () => {
    it('returns portal URL', async () => {
      mockPortalSessionsCreate.mockResolvedValue({ url: 'https://billing.stripe.com/session' });

      const result = await provider.createPortalSession('cus_1', 'https://app.test/settings');
      expect(result.url).toBe('https://billing.stripe.com/session');
    });
  });

  describe('syncPlanToStripe', () => {
    it('creates new product and price when no existing product', async () => {
      mockProductsCreate.mockResolvedValue({ id: 'prod_new' });
      mockPricesCreate.mockResolvedValue({ id: 'price_new' });

      const result = await provider.syncPlanToStripe({
        id: 'plan-1',
        name: 'Pro Plan',
        description: 'Pro features',
        slug: 'pro',
        priceCents: 2999,
        billingInterval: 'monthly',
        stripeProductId: null,
      });

      expect(result.productId).toBe('prod_new');
      expect(result.priceId).toBe('price_new');
    });

    it('updates existing product when stripeProductId exists', async () => {
      mockProductsUpdate.mockResolvedValue({});
      mockPricesCreate.mockResolvedValue({ id: 'price_updated' });

      const result = await provider.syncPlanToStripe({
        id: 'plan-1',
        name: 'Pro Plan v2',
        description: null,
        slug: 'pro',
        priceCents: 3999,
        billingInterval: 'yearly',
        stripeProductId: 'prod_existing',
      });

      expect(result.productId).toBe('prod_existing');
      expect(result.priceId).toBe('price_updated');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('delegates to stripe.webhooks.constructEvent', () => {
      const fakeEvent = { type: 'checkout.session.completed' };
      mockWebhooksConstructEvent.mockReturnValue(fakeEvent);

      const result = provider.verifyWebhookSignature('payload', 'sig_header');
      expect(result).toBe(fakeEvent);
    });
  });
});

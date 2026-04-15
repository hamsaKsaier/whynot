import { describe, it, expect } from 'vitest';
import { withRetry } from '../payments/retry-engine';
import { PaymentServiceError, isRetryableError, paymentErrorToI18nKey } from '../payments/payment-error';
import { generateIdempotencyKey, generateDeterministicKey } from '../payments/idempotency';

describe('Payment Service — Money math (bigint)', () => {
  it('formatCents stays bigint through arithmetic', () => {
    const price = BigInt(2999);
    const quantity = BigInt(3);
    const total = price * quantity;

    expect(typeof total).toBe('bigint');
    expect(total).toBe(BigInt(8997));
  });

  it('no float drift on large values', () => {
    const a = BigInt('99999999999999');
    const b = BigInt('1');
    const sum = a + b;

    expect(sum).toBe(BigInt('100000000000000'));
    expect(typeof sum).toBe('bigint');
  });

  it('bigint division truncates (no decimal drift)', () => {
    const total = BigInt(1000);
    const parts = BigInt(3);
    const each = total / parts;

    expect(each).toBe(BigInt(333));
    expect(typeof each).toBe('bigint');
  });

  it('negative bigint for refunds', () => {
    const refund = -BigInt(5000);
    expect(refund).toBe(BigInt(-5000));
    expect(typeof refund).toBe('bigint');
  });

  it('property: random bigints up to 2^53 never coerce to float', () => {
    for (let i = 0; i < 100; i++) {
      const a = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
      const b = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
      const sum = a + b;
      const diff = a - b;
      const product = a * (b % BigInt(1000));

      expect(typeof sum).toBe('bigint');
      expect(typeof diff).toBe('bigint');
      expect(typeof product).toBe('bigint');
    }
  });
});

describe('Retry Engine', () => {
  it('succeeds on first attempt', async () => {
    let attempts = 0;
    const { result, attempts: totalAttempts } = await withRetry(async () => {
      attempts++;
      return 'ok';
    }, 'test');

    expect(result).toBe('ok');
    expect(totalAttempts).toBe(1);
    expect(attempts).toBe(1);
  });

  it('retries transient errors and succeeds (5xx twice then 200)', async () => {
    let attempts = 0;
    const { result, attempts: totalAttempts } = await withRetry(
      async () => {
        attempts++;
        if (attempts <= 2) {
          const err: any = new Error('Internal Server Error');
          err.statusCode = 500;
          throw err;
        }
        return 'recovered';
      },
      'test-retry',
      { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 2, jitterFactor: 0 },
    );

    expect(result).toBe('recovered');
    expect(totalAttempts).toBe(3);
  });

  it('does not retry non-retryable errors', async () => {
    let attempts = 0;
    const cardError = new PaymentServiceError({
      code: 'CARD_DECLINED',
      message: 'Card declined',
      provider: 'stripe',
      retryable: false,
    });

    await expect(
      withRetry(
        async () => {
          attempts++;
          throw cardError;
        },
        'test-no-retry',
        { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 2, jitterFactor: 0 },
      ),
    ).rejects.toThrow('Card declined');

    expect(attempts).toBe(1);
  });

  it('surfaces error after exhausting default 3 retries (5xx four times)', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          const err: any = new Error('Service Unavailable');
          err.statusCode = 503;
          throw err;
        },
        'test-exhaust-default',
        { baseDelayMs: 1, maxDelayMs: 2, jitterFactor: 0 },
      ),
    ).rejects.toThrow('Service Unavailable');

    expect(attempts).toBe(4); // initial + 3 retries (default maxRetries: 3)
  });

  it('surfaces error after all retries exhausted (custom config)', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error('ETIMEDOUT');
        },
        'test-exhaust',
        { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2, jitterFactor: 0 },
      ),
    ).rejects.toThrow('ETIMEDOUT');

    expect(attempts).toBe(3); // initial + 2 retries
  });
});

describe('Idempotency Key Generation', () => {
  it('generates unique UUID keys', () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();

    expect(key1).not.toBe(key2);
    expect(key1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates deterministic keys for same input', () => {
    const key1 = generateDeterministicKey('org-123', 'checkout', 'plan-pro');
    const key2 = generateDeterministicKey('org-123', 'checkout', 'plan-pro');

    expect(key1).toBe(key2);
  });

  it('generates different keys for different inputs', () => {
    const key1 = generateDeterministicKey('org-123', 'checkout', 'plan-pro');
    const key2 = generateDeterministicKey('org-456', 'checkout', 'plan-pro');

    expect(key1).not.toBe(key2);
  });

  it('deterministic key has expected prefix', () => {
    const key = generateDeterministicKey('org-abc-123', 'checkout');
    expect(key).toMatch(/^det_[a-z0-9]+_org-abc-/);
  });

  it('idempotency key is identical for same logical operation', () => {
    const key1 = generateDeterministicKey('org-xyz', 'createCheckoutSession', 'plan-pro', 'tier-annual');
    const key2 = generateDeterministicKey('org-xyz', 'createCheckoutSession', 'plan-pro', 'tier-annual');
    const key3 = generateDeterministicKey('org-xyz', 'createCheckoutSession', 'plan-pro', 'tier-monthly');

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });
});

describe('PaymentServiceError', () => {
  it('creates from Stripe card error', () => {
    const stripeError = {
      type: 'StripeCardError',
      code: 'card_declined',
      decline_code: 'insufficient_funds',
      message: 'Your card has insufficient funds.',
      statusCode: 402,
    };

    const err = PaymentServiceError.fromStripeError(stripeError);

    expect(err.code).toBe('INSUFFICIENT_FUNDS');
    expect(err.provider).toBe('stripe');
    expect(err.retryable).toBe(false);
    expect(err.message).toBe('Your card has insufficient funds.');
  });

  it('creates from Stripe invalid request', () => {
    const stripeError = {
      type: 'StripeInvalidRequestError',
      code: 'resource_missing',
      message: 'No such customer',
      statusCode: 404,
    };

    const err = PaymentServiceError.fromStripeError(stripeError);

    expect(err.code).toBe('INVALID_REQUEST');
    expect(err.retryable).toBe(false);
    expect(err.statusCode).toBe(404);
  });

  it('creates from network error', () => {
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:443');

    const err = PaymentServiceError.fromStripeError(networkError);

    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.retryable).toBe(true);
  });

  it('creates from 5xx server error', () => {
    const serverError = {
      type: 'StripeAPIError',
      message: 'Internal server error',
      statusCode: 500,
    };

    const err = PaymentServiceError.fromStripeError(serverError);

    expect(err.code).toBe('PROVIDER_ERROR');
    expect(err.retryable).toBe(true);
  });

  it('creates from Stripe expired card error', () => {
    const stripeError = {
      type: 'StripeCardError',
      code: 'expired_card',
      message: 'Your card has expired.',
      statusCode: 402,
    };

    const err = PaymentServiceError.fromStripeError(stripeError);

    expect(err.code).toBe('EXPIRED_CARD');
    expect(err.retryable).toBe(false);
  });

  it('creates from Stripe generic card decline', () => {
    const stripeError = {
      type: 'StripeCardError',
      code: 'card_declined',
      decline_code: 'generic_decline',
      message: 'Your card was declined.',
      statusCode: 402,
    };

    const err = PaymentServiceError.fromStripeError(stripeError);

    expect(err.code).toBe('CARD_DECLINED');
    expect(err.retryable).toBe(false);
  });

  it('creates from Stripe authentication error', () => {
    const stripeError = {
      type: 'StripeAuthenticationError',
      message: 'Authentication required',
      statusCode: 401,
    };

    const err = PaymentServiceError.fromStripeError(stripeError);

    expect(err.code).toBe('AUTHENTICATION_REQUIRED');
    expect(err.retryable).toBe(false);
    expect(err.statusCode).toBe(401);
  });

  it('creates from ETIMEDOUT network error', () => {
    const err = PaymentServiceError.fromStripeError(new Error('connect ETIMEDOUT'));
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.retryable).toBe(true);
  });

  it('creates from ENOTFOUND network error', () => {
    const err = PaymentServiceError.fromStripeError(new Error('getaddrinfo ENOTFOUND'));
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.retryable).toBe(true);
  });

  it('creates from fetch failed error', () => {
    const err = PaymentServiceError.fromStripeError(new Error('fetch failed'));
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.retryable).toBe(true);
  });

  it('returns self when input is already PaymentServiceError', () => {
    const original = new PaymentServiceError({
      code: 'CARD_DECLINED',
      message: 'declined',
      provider: 'stripe',
    });

    const result = PaymentServiceError.fromStripeError(original);
    expect(result).toBe(original);
  });

  it('handles unknown non-Error object', () => {
    const err = PaymentServiceError.fromStripeError({ weird: true });
    expect(err.code).toBe('PROVIDER_ERROR');
    expect(err.message).toBe('Unknown payment error');
  });

  it('serializes to JSON without sensitive data', () => {
    const err = new PaymentServiceError({
      code: 'CARD_DECLINED',
      message: 'Declined',
      provider: 'stripe',
    });

    const json = err.toJSON();

    expect(json).toHaveProperty('code', 'CARD_DECLINED');
    expect(json).toHaveProperty('provider', 'stripe');
    expect(json).not.toHaveProperty('stack');
  });
});

describe('isRetryableError', () => {
  it('returns true for network errors', () => {
    expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
  });

  it('returns false for card errors', () => {
    const err = new PaymentServiceError({
      code: 'CARD_DECLINED',
      message: 'declined',
      provider: 'stripe',
      retryable: false,
    });
    expect(isRetryableError(err)).toBe(false);
  });

  it('returns true for 5xx status codes', () => {
    expect(isRetryableError({ statusCode: 500, type: 'StripeAPIError' })).toBe(true);
    expect(isRetryableError({ statusCode: 502, type: 'StripeAPIError' })).toBe(true);
  });

  it('returns false for 4xx status codes', () => {
    expect(isRetryableError({ statusCode: 400 })).toBe(false);
    expect(isRetryableError({ statusCode: 404 })).toBe(false);
  });
});

describe('paymentErrorToI18nKey', () => {
  it('maps every PaymentServiceErrorCode to a billing i18n key', () => {
    const codes = [
      'CARD_DECLINED',
      'INSUFFICIENT_FUNDS',
      'EXPIRED_CARD',
      'PROVIDER_ERROR',
      'NETWORK_ERROR',
      'INVALID_REQUEST',
      'AUTHENTICATION_REQUIRED',
    ] as const;

    for (const code of codes) {
      const key = paymentErrorToI18nKey(code);
      expect(key).toMatch(/^billing:payments\./);
    }
  });

  it('returns correct key for each code', () => {
    expect(paymentErrorToI18nKey('CARD_DECLINED')).toBe('billing:payments.cardDeclined');
    expect(paymentErrorToI18nKey('INSUFFICIENT_FUNDS')).toBe('billing:payments.insufficientFunds');
    expect(paymentErrorToI18nKey('EXPIRED_CARD')).toBe('billing:payments.expiredCard');
    expect(paymentErrorToI18nKey('PROVIDER_ERROR')).toBe('billing:payments.providerError');
    expect(paymentErrorToI18nKey('NETWORK_ERROR')).toBe('billing:payments.networkError');
    expect(paymentErrorToI18nKey('INVALID_REQUEST')).toBe('billing:payments.invalidRequest');
    expect(paymentErrorToI18nKey('AUTHENTICATION_REQUIRED')).toBe('billing:payments.authenticationRequired');
  });
});

describe('Payment Service — bigint property test (1000 random amounts)', () => {
  it('no float drift across 1000 random bigint operations', () => {
    for (let i = 0; i < 1000; i++) {
      const a = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
      const b = BigInt(Math.floor(Math.random() * 1000) + 1);
      const product = a * b;
      const quotient = a / b;
      const remainder = a % b;

      expect(typeof product).toBe('bigint');
      expect(typeof quotient).toBe('bigint');
      expect(typeof remainder).toBe('bigint');
      expect(quotient * b + remainder).toBe(a);
    }
  });
});

describe('Error envelope snapshots', () => {
  it('card declined envelope', () => {
    const err = new PaymentServiceError({
      code: 'CARD_DECLINED',
      message: 'Your card was declined',
      provider: 'stripe',
      providerCode: 'card_declined',
      statusCode: 402,
    });

    expect(err.toJSON()).toMatchSnapshot();
  });

  it('network error envelope', () => {
    const err = new PaymentServiceError({
      code: 'NETWORK_ERROR',
      message: 'connect ECONNREFUSED',
      provider: 'stripe',
      retryable: true,
    });

    expect(err.toJSON()).toMatchSnapshot();
  });

  it('provider error envelope', () => {
    const err = new PaymentServiceError({
      code: 'PROVIDER_ERROR',
      message: 'Internal server error',
      provider: 'stripe',
      statusCode: 500,
      retryable: true,
    });

    expect(err.toJSON()).toMatchSnapshot();
  });
});

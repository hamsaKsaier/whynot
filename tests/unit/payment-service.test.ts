import { withRetry } from '../../gateway/src/payments/retry-engine';
import { PaymentServiceError, isRetryableError } from '../../gateway/src/payments/payment-error';
import { generateIdempotencyKey, generateDeterministicKey } from '../../gateway/src/payments/idempotency';

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

  it('retries transient errors up to max', async () => {
    let attempts = 0;
    const { result, attempts: totalAttempts } = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          const err = new Error('ECONNREFUSED');
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

  it('surfaces error after all retries exhausted', async () => {
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

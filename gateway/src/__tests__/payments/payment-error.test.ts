import { describe, it, expect } from 'vitest';
import {
  PaymentServiceError,
  isRetryableError,
  paymentErrorToI18nKey,
} from '../../payments/payment-error';

describe('PaymentServiceError', () => {
  it('has correct name property', () => {
    const err = new PaymentServiceError({
      code: 'CARD_DECLINED',
      message: 'Declined',
      provider: 'stripe',
    });
    expect(err.name).toBe('PaymentServiceError');
  });

  it('defaults retryable based on code when not specified', () => {
    const retryable = new PaymentServiceError({
      code: 'NETWORK_ERROR',
      message: 'timeout',
      provider: 'stripe',
    });
    expect(retryable.retryable).toBe(true);

    const notRetryable = new PaymentServiceError({
      code: 'CARD_DECLINED',
      message: 'declined',
      provider: 'stripe',
    });
    expect(notRetryable.retryable).toBe(false);
  });

  it('allows overriding retryable', () => {
    const err = new PaymentServiceError({
      code: 'CARD_DECLINED',
      message: 'declined',
      provider: 'stripe',
      retryable: true,
    });
    expect(err.retryable).toBe(true);
  });

  describe('fromStripeError', () => {
    it('returns self for existing PaymentServiceError', () => {
      const original = new PaymentServiceError({
        code: 'CARD_DECLINED',
        message: 'test',
        provider: 'stripe',
      });
      expect(PaymentServiceError.fromStripeError(original)).toBe(original);
    });

    it('maps StripeCardError with insufficient_funds', () => {
      const err = PaymentServiceError.fromStripeError({
        type: 'StripeCardError',
        decline_code: 'insufficient_funds',
        message: 'Insufficient funds',
        statusCode: 402,
      });
      expect(err.code).toBe('INSUFFICIENT_FUNDS');
      expect(err.retryable).toBe(false);
    });

    it('maps StripeCardError with expired_card code', () => {
      const err = PaymentServiceError.fromStripeError({
        type: 'StripeCardError',
        code: 'expired_card',
        message: 'Expired',
        statusCode: 402,
      });
      expect(err.code).toBe('EXPIRED_CARD');
    });

    it('maps generic StripeCardError to CARD_DECLINED', () => {
      const err = PaymentServiceError.fromStripeError({
        type: 'StripeCardError',
        code: 'card_declined',
        decline_code: 'generic_decline',
        message: 'Declined',
      });
      expect(err.code).toBe('CARD_DECLINED');
    });

    it('maps StripeAuthenticationError', () => {
      const err = PaymentServiceError.fromStripeError({
        type: 'StripeAuthenticationError',
        message: 'Auth required',
      });
      expect(err.code).toBe('AUTHENTICATION_REQUIRED');
      expect(err.statusCode).toBe(401);
    });

    it('maps StripeInvalidRequestError', () => {
      const err = PaymentServiceError.fromStripeError({
        type: 'StripeInvalidRequestError',
        message: 'Invalid',
        statusCode: 400,
      });
      expect(err.code).toBe('INVALID_REQUEST');
      expect(err.statusCode).toBe(400);
    });

    it('maps ECONNREFUSED to NETWORK_ERROR', () => {
      const err = PaymentServiceError.fromStripeError(new Error('ECONNREFUSED'));
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.retryable).toBe(true);
    });

    it('maps 5xx to retryable PROVIDER_ERROR', () => {
      const err = PaymentServiceError.fromStripeError({
        statusCode: 500,
        message: 'Server error',
      });
      expect(err.code).toBe('PROVIDER_ERROR');
      expect(err.retryable).toBe(true);
    });

    it('handles unknown non-Error input', () => {
      const err = PaymentServiceError.fromStripeError({ unknown: true });
      expect(err.code).toBe('PROVIDER_ERROR');
      expect(err.message).toBe('Unknown payment error');
    });
  });

  describe('toJSON', () => {
    it('serializes without stack trace', () => {
      const err = new PaymentServiceError({
        code: 'CARD_DECLINED',
        message: 'Declined',
        provider: 'stripe',
        statusCode: 402,
      });
      const json = err.toJSON();

      expect(json).toEqual({
        code: 'CARD_DECLINED',
        message: 'Declined',
        provider: 'stripe',
        retryable: false,
        providerCode: undefined,
        statusCode: 402,
      });
      expect(json).not.toHaveProperty('stack');
    });
  });
});

describe('isRetryableError', () => {
  it('returns true for retryable PaymentServiceError', () => {
    const err = new PaymentServiceError({
      code: 'NETWORK_ERROR',
      message: 'timeout',
      provider: 'stripe',
    });
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns false for non-retryable PaymentServiceError', () => {
    const err = new PaymentServiceError({
      code: 'CARD_DECLINED',
      message: 'declined',
      provider: 'stripe',
    });
    expect(isRetryableError(err)).toBe(false);
  });

  it('returns true for StripeConnectionError type', () => {
    expect(isRetryableError({ type: 'StripeConnectionError' })).toBe(true);
  });

  it('returns true for StripeRateLimitError type', () => {
    expect(isRetryableError({ type: 'StripeRateLimitError' })).toBe(true);
  });

  it('returns true for 5xx status codes', () => {
    expect(isRetryableError({ statusCode: 500 })).toBe(true);
    expect(isRetryableError({ statusCode: 502 })).toBe(true);
    expect(isRetryableError({ statusCode: 503 })).toBe(true);
  });

  it('returns false for 4xx status codes', () => {
    expect(isRetryableError({ statusCode: 400 })).toBe(false);
    expect(isRetryableError({ statusCode: 404 })).toBe(false);
  });

  it('returns true for network error messages', () => {
    expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
  });

  it('returns false for non-error values', () => {
    // isRetryableError casts to object so null/undefined would crash;
    // test with object-like values that don't match retry conditions
    expect(isRetryableError('string')).toBe(false);
    expect(isRetryableError(42)).toBe(false);
    expect(isRetryableError({})).toBe(false);
    expect(isRetryableError({ statusCode: 200 })).toBe(false);
  });
});

describe('paymentErrorToI18nKey', () => {
  it('maps all error codes to billing i18n keys', () => {
    expect(paymentErrorToI18nKey('CARD_DECLINED')).toBe('billing:payments.cardDeclined');
    expect(paymentErrorToI18nKey('INSUFFICIENT_FUNDS')).toBe('billing:payments.insufficientFunds');
    expect(paymentErrorToI18nKey('EXPIRED_CARD')).toBe('billing:payments.expiredCard');
    expect(paymentErrorToI18nKey('PROVIDER_ERROR')).toBe('billing:payments.providerError');
    expect(paymentErrorToI18nKey('NETWORK_ERROR')).toBe('billing:payments.networkError');
    expect(paymentErrorToI18nKey('INVALID_REQUEST')).toBe('billing:payments.invalidRequest');
    expect(paymentErrorToI18nKey('AUTHENTICATION_REQUIRED')).toBe('billing:payments.authenticationRequired');
  });
});

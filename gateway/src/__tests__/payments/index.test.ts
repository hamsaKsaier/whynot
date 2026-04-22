import { describe, it, expect } from 'vitest';

// Test that the barrel file re-exports all expected symbols
import {
  PaymentServiceError,
  isRetryableError,
  paymentErrorToI18nKey,
  withRetry,
  generateIdempotencyKey,
  generateDeterministicKey,
  writePaymentAuditLog,
  auditedOperation,
} from '../../payments/index';

describe('payments/index barrel exports', () => {
  it('exports PaymentServiceError class', () => {
    expect(PaymentServiceError).toBeDefined();
    expect(typeof PaymentServiceError).toBe('function');
  });

  it('exports isRetryableError function', () => {
    expect(typeof isRetryableError).toBe('function');
  });

  it('exports paymentErrorToI18nKey function', () => {
    expect(typeof paymentErrorToI18nKey).toBe('function');
  });

  it('exports withRetry function', () => {
    expect(typeof withRetry).toBe('function');
  });

  it('exports generateIdempotencyKey function', () => {
    expect(typeof generateIdempotencyKey).toBe('function');
  });

  it('exports generateDeterministicKey function', () => {
    expect(typeof generateDeterministicKey).toBe('function');
  });

  it('exports writePaymentAuditLog function', () => {
    expect(typeof writePaymentAuditLog).toBe('function');
  });

  it('exports auditedOperation function', () => {
    expect(typeof auditedOperation).toBe('function');
  });
});

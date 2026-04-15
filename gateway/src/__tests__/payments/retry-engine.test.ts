import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../payments/retry-engine';
import { PaymentServiceError } from '../../payments/payment-error';

describe('withRetry', () => {
  it('returns result on first attempt success', async () => {
    const { result, attempts, totalDurationMs } = await withRetry(
      async () => 'ok',
      'testOp',
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(1);
    expect(totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('retries on retryable errors and succeeds', async () => {
    let count = 0;
    const { result, attempts } = await withRetry(
      async () => {
        count++;
        if (count < 3) {
          const err: any = new Error('Server error');
          err.statusCode = 500;
          throw err;
        }
        return 'recovered';
      },
      'retryTest',
      { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 2, jitterFactor: 0 },
    );

    expect(result).toBe('recovered');
    expect(attempts).toBe(3);
  });

  it('does not retry non-retryable errors', async () => {
    let count = 0;
    const cardError = new PaymentServiceError({
      code: 'CARD_DECLINED',
      message: 'Declined',
      provider: 'stripe',
      retryable: false,
    });

    await expect(
      withRetry(
        async () => {
          count++;
          throw cardError;
        },
        'nonRetryable',
        { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 2, jitterFactor: 0 },
      ),
    ).rejects.toThrow('Declined');

    expect(count).toBe(1);
  });

  it('throws after exhausting retries', async () => {
    let count = 0;
    await expect(
      withRetry(
        async () => {
          count++;
          const err: any = new Error('ETIMEDOUT');
          throw err;
        },
        'exhaustRetries',
        { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2, jitterFactor: 0 },
      ),
    ).rejects.toThrow('ETIMEDOUT');

    expect(count).toBe(3); // initial + 2 retries
  });

  it('uses exponential backoff with jitter', async () => {
    let count = 0;
    const timestamps: number[] = [];
    await expect(
      withRetry(
        async () => {
          timestamps.push(Date.now());
          count++;
          const err: any = new Error('Server error');
          err.statusCode = 500;
          throw err;
        },
        'backoffTest',
        { maxRetries: 2, baseDelayMs: 50, maxDelayMs: 500, jitterFactor: 0 },
      ),
    ).rejects.toThrow();

    expect(count).toBe(3);
    // Second attempt should be delayed by ~50ms (baseDelay * 2^0)
    if (timestamps.length >= 2) {
      expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(40);
    }
  });

  it('respects maxDelayMs cap', async () => {
    let count = 0;
    const timestamps: number[] = [];
    await expect(
      withRetry(
        async () => {
          timestamps.push(Date.now());
          count++;
          const err: any = new Error('Server error');
          err.statusCode = 500;
          throw err;
        },
        'capTest',
        { maxRetries: 1, baseDelayMs: 10000, maxDelayMs: 10, jitterFactor: 0 },
      ),
    ).rejects.toThrow();

    expect(count).toBe(2);
    // Delay should be capped at 10ms (plus execution overhead)
    if (timestamps.length >= 2) {
      expect(timestamps[1] - timestamps[0]).toBeLessThan(100);
    }
  });

  it('tracks total duration across all attempts', async () => {
    let count = 0;
    const { totalDurationMs, attempts } = await withRetry(
      async () => {
        count++;
        if (count < 2) {
          const err: any = new Error('retry');
          err.statusCode = 500;
          throw err;
        }
        return 'done';
      },
      'durationTest',
      { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 20, jitterFactor: 0 },
    );

    expect(attempts).toBe(2);
    expect(totalDurationMs).toBeGreaterThanOrEqual(5);
  });
});

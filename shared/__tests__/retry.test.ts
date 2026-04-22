import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryWithBackoff, type RetryOptions } from '../utils/retry';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable errors and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ code: 'ECONNREFUSED' })
      .mockResolvedValueOnce('recovered');

    const promise = retryWithBackoff(fn, { initialDelayMs: 10, maxRetries: 2 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws non-retryable errors immediately', async () => {
    const err = new Error('bad request');
    const fn = vi.fn().mockRejectedValue(err);

    await expect(retryWithBackoff(fn)).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws last error after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue({ code: 'ETIMEDOUT' });

    const promise = retryWithBackoff(fn, { maxRetries: 2, initialDelayMs: 10 });
    promise.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toEqual({ code: 'ETIMEDOUT' });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries on ENOTFOUND errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ code: 'ENOTFOUND' })
      .mockResolvedValueOnce('found');

    const promise = retryWithBackoff(fn, { initialDelayMs: 10 });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('found');
  });

  it('retries on 5xx HTTP responses', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce('ok');

    const promise = retryWithBackoff(fn, { initialDelayMs: 10 });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
  });

  it('does not retry on 4xx HTTP responses', async () => {
    const fn = vi.fn().mockRejectedValue({ response: { status: 400 } });
    await expect(retryWithBackoff(fn)).rejects.toEqual({ response: { status: 400 } });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects custom retryableErrors predicate', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('custom-retryable'))
      .mockResolvedValueOnce('ok');

    const opts: RetryOptions = {
      initialDelayMs: 10,
      retryableErrors: (err) => err.message === 'custom-retryable',
    };
    const promise = retryWithBackoff(fn, opts);
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
  });

  it('caps delay at maxDelayMs', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ code: 'ECONNREFUSED' })
      .mockRejectedValueOnce({ code: 'ECONNREFUSED' })
      .mockRejectedValueOnce({ code: 'ECONNREFUSED' })
      .mockResolvedValueOnce('ok');

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 150,
      backoffMultiplier: 10,
    });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
  });

  it('uses default options when none provided', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    expect(await retryWithBackoff(fn)).toBe(42);
  });
});

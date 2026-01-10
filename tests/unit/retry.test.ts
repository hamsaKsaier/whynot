/**
 * Unit tests for retry utility
 */

import { retryWithBackoff } from '../../shared/utils/retry';

describe('Retry Utility', () => {
  it('should succeed on first attempt', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      return 'success';
    };

    const result = await retryWithBackoff(fn);
    expect(result).toBe('success');
    expect(attempts).toBe(1);
  });

  it('should retry on retryable errors', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        const error: any = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        throw error;
      }
      return 'success';
    };

    const result = await retryWithBackoff(fn, { maxRetries: 3 });
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should not retry on non-retryable errors', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      const error: any = new Error('Validation error');
      error.response = { status: 400 };
      throw error;
    };

    try {
      await retryWithBackoff(fn);
      fail('Should have thrown an error');
    } catch (error: any) {
      expect(attempts).toBe(1);
      expect(error.message).toBe('Validation error');
    }
  });

  it('should respect max retries', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      const error: any = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      throw error;
    };

    try {
      await retryWithBackoff(fn, { maxRetries: 2 });
      fail('Should have thrown an error');
    } catch (error: any) {
      expect(attempts).toBe(3); // Initial + 2 retries
    }
  });
});


























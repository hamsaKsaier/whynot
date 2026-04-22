import { describe, it, expect } from 'vitest';
import {
  apiRateLimiter,
  testExecutionRateLimiter,
  testGenerationRateLimiter,
  qaLoopSessionRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
  publicEndpointRateLimiter,
} from '../../middleware/rate-limit';

describe('rate-limit', () => {
  it('apiRateLimiter is an express middleware function', () => {
    expect(typeof apiRateLimiter).toBe('function');
  });

  it('testExecutionRateLimiter is an express middleware function', () => {
    expect(typeof testExecutionRateLimiter).toBe('function');
  });

  it('testGenerationRateLimiter is an express middleware function', () => {
    expect(typeof testGenerationRateLimiter).toBe('function');
  });

  it('qaLoopSessionRateLimiter is an express middleware function', () => {
    expect(typeof qaLoopSessionRateLimiter).toBe('function');
  });

  it('loginRateLimiter is an express middleware function', () => {
    expect(typeof loginRateLimiter).toBe('function');
  });

  it('registerRateLimiter is an express middleware function', () => {
    expect(typeof registerRateLimiter).toBe('function');
  });

  it('publicEndpointRateLimiter is an express middleware function', () => {
    expect(typeof publicEndpointRateLimiter).toBe('function');
  });

  it('all rate limiters are distinct instances', () => {
    const limiters = [
      apiRateLimiter,
      testExecutionRateLimiter,
      testGenerationRateLimiter,
      qaLoopSessionRateLimiter,
      loginRateLimiter,
      registerRateLimiter,
      publicEndpointRateLimiter,
    ];

    const unique = new Set(limiters);
    expect(unique.size).toBe(limiters.length);
  });
});

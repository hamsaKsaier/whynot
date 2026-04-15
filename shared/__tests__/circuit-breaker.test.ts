import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../utils/circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxCalls: 2,
    });
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('passes through successful calls in CLOSED state', async () => {
    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('opens after reaching failure threshold', async () => {
    const err = new Error('fail');
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(err))).rejects.toThrow('fail');
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('rejects calls when OPEN', async () => {
    const err = new Error('fail');
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(err))).rejects.toThrow();
    }
    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toThrow(
      'Circuit breaker is OPEN'
    );
  });

  it('transitions to HALF_OPEN after reset timeout', async () => {
    vi.useFakeTimers();
    const err = new Error('fail');
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(err))).rejects.toThrow();
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    vi.advanceTimersByTime(1001);
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    vi.useRealTimers();
  });

  it('closes from HALF_OPEN on success', async () => {
    vi.useFakeTimers();
    const err = new Error('fail');
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(err))).rejects.toThrow();
    }

    vi.advanceTimersByTime(1001);
    await breaker.execute(() => Promise.resolve('recovered'));
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    vi.useRealTimers();
  });

  it('reopens from HALF_OPEN on failure', async () => {
    vi.useFakeTimers();
    const err = new Error('fail');
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(err))).rejects.toThrow();
    }

    vi.advanceTimersByTime(1001);
    await expect(breaker.execute(() => Promise.reject(new Error('still failing')))).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    vi.useRealTimers();
  });

  it('resets failure count on success in CLOSED state', async () => {
    const err = new Error('fail');
    await expect(breaker.execute(() => Promise.reject(err))).rejects.toThrow();
    await expect(breaker.execute(() => Promise.reject(err))).rejects.toThrow();
    await breaker.execute(() => Promise.resolve('ok'));
    await expect(breaker.execute(() => Promise.reject(err))).rejects.toThrow();
    await expect(breaker.execute(() => Promise.reject(err))).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('manual reset returns to CLOSED', async () => {
    const err = new Error('fail');
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(err))).rejects.toThrow();
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    breaker.reset();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('uses default options when none provided', () => {
    const defaultBreaker = new CircuitBreaker();
    expect(defaultBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  describe('CircuitState enum', () => {
    it('has correct values', () => {
      expect(CircuitState.CLOSED).toBe('closed');
      expect(CircuitState.OPEN).toBe('open');
      expect(CircuitState.HALF_OPEN).toBe('half_open');
    });
  });
});

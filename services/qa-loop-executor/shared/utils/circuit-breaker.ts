/**
 * Circuit Breaker pattern implementation
 */

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxCalls?: number;
}

export enum CircuitState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Failing, reject requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenCalls: number = 0;

  constructor(
    private options: CircuitBreakerOptions = {}
  ) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeoutMs: options.resetTimeoutMs || 60000, // 1 minute
      halfOpenMaxCalls: options.halfOpenMaxCalls || 3
    };
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition
    this.updateState();

    // Reject if circuit is open
    if (this.state === CircuitState.OPEN) {
      throw new Error('Circuit breaker is OPEN - service unavailable');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error: any) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    this.updateState();
    return this.state;
  }

  /**
   * Reset circuit breaker manually
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = 0;
  }

  private updateState(): void {
    const now = Date.now();

    if (this.state === CircuitState.OPEN) {
      // Check if reset timeout has passed
      if (now - this.lastFailureTime >= this.options.resetTimeoutMs!) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCalls = 0;
      }
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      // Success in half-open state - close the circuit
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.halfOpenCalls = 0;
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in half-open - open the circuit
      this.state = CircuitState.OPEN;
      this.halfOpenCalls = 0;
    } else if (this.state === CircuitState.CLOSED) {
      // Check if threshold reached
      if (this.failureCount >= this.options.failureThreshold!) {
        this.state = CircuitState.OPEN;
      }
    }
  }
}


























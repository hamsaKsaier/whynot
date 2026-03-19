/**
 * Circuit Breaker pattern implementation
 */
export interface CircuitBreakerOptions {
    failureThreshold?: number;
    resetTimeoutMs?: number;
    halfOpenMaxCalls?: number;
}
export declare enum CircuitState {
    CLOSED = "closed",// Normal operation
    OPEN = "open",// Failing, reject requests
    HALF_OPEN = "half_open"
}
export declare class CircuitBreaker {
    private options;
    private state;
    private failureCount;
    private lastFailureTime;
    private halfOpenCalls;
    constructor(options?: CircuitBreakerOptions);
    /**
     * Execute a function through the circuit breaker
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Get current circuit state
     */
    getState(): CircuitState;
    /**
     * Reset circuit breaker manually
     */
    reset(): void;
    private updateState;
    private onSuccess;
    private onFailure;
}
//# sourceMappingURL=circuit-breaker.d.ts.map
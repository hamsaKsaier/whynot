"use strict";
/**
 * Circuit Breaker pattern implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitState = void 0;
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "closed";
    CircuitState["OPEN"] = "open";
    CircuitState["HALF_OPEN"] = "half_open"; // Testing if service recovered
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker {
    constructor(options = {}) {
        this.options = options;
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.halfOpenCalls = 0;
        this.options = {
            failureThreshold: options.failureThreshold || 5,
            resetTimeoutMs: options.resetTimeoutMs || 60000, // 1 minute
            halfOpenMaxCalls: options.halfOpenMaxCalls || 3
        };
    }
    /**
     * Execute a function through the circuit breaker
     */
    async execute(fn) {
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
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    /**
     * Get current circuit state
     */
    getState() {
        this.updateState();
        return this.state;
    }
    /**
     * Reset circuit breaker manually
     */
    reset() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.halfOpenCalls = 0;
        this.lastFailureTime = 0;
    }
    updateState() {
        const now = Date.now();
        if (this.state === CircuitState.OPEN) {
            // Check if reset timeout has passed
            if (now - this.lastFailureTime >= this.options.resetTimeoutMs) {
                this.state = CircuitState.HALF_OPEN;
                this.halfOpenCalls = 0;
            }
        }
    }
    onSuccess() {
        if (this.state === CircuitState.HALF_OPEN) {
            // Success in half-open state - close the circuit
            this.state = CircuitState.CLOSED;
            this.failureCount = 0;
            this.halfOpenCalls = 0;
        }
        else if (this.state === CircuitState.CLOSED) {
            // Reset failure count on success
            this.failureCount = 0;
        }
    }
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.state === CircuitState.HALF_OPEN) {
            // Failure in half-open - open the circuit
            this.state = CircuitState.OPEN;
            this.halfOpenCalls = 0;
        }
        else if (this.state === CircuitState.CLOSED) {
            // Check if threshold reached
            if (this.failureCount >= this.options.failureThreshold) {
                this.state = CircuitState.OPEN;
            }
        }
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=circuit-breaker.js.map
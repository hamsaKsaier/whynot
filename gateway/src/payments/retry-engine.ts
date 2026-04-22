import { isRetryableError } from './payment-error';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  jitterFactor: 0.1,
};

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalDurationMs: number;
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * config.jitterFactor * Math.random();
  return Math.floor(cappedDelay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: Partial<RetryConfig> = {},
): Promise<RetryResult<T>> {
  const fullConfig: RetryConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      const result = await operation();
      return {
        result,
        attempts: attempt + 1,
        totalDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt < fullConfig.maxRetries) {
        const delay = calculateDelay(attempt, fullConfig);
        console.warn(
          `[RetryEngine] ${operationName}: attempt ${attempt + 1}/${fullConfig.maxRetries + 1} failed, retrying in ${delay}ms`,
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('rate-limiter');

/**
 * Rate limiter for Google AI Studio free tier:
 *   - 30 RPM  (requests per minute)
 *   - 250K TPM (tokens per minute)
 *
 * Enforces both limits with safety margins (28 RPM, 230K TPM).
 */
export class RateLimiter {
  private requestTimestamps: number[] = [];
  private minuteTokenCount = 0;
  private minuteStart = Date.now();

  async waitIfNeeded(estimatedInputTokens: number): Promise<void> {
    const now = Date.now();

    // Reset token counter every 60 seconds
    if (now - this.minuteStart > 60_000) {
      this.minuteTokenCount = 0;
      this.minuteStart = now;
    }

    // Enforce RPM (max 28 per minute, leave 2 buffer)
    const windowStart = now - 60_000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > windowStart);
    if (this.requestTimestamps.length >= 28) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitMs = oldestInWindow - windowStart + 200;
      if (waitMs > 0) {
        logger.info('Rate limiter: waiting for RPM cooldown', { waitMs });
        await sleep(waitMs);
      }
    }

    // Enforce TPM (max 230K per minute, leave 20K buffer)
    if (this.minuteTokenCount + estimatedInputTokens > 230_000) {
      const waitMs = this.minuteStart + 60_000 - Date.now() + 200;
      if (waitMs > 0) {
        logger.info('Rate limiter: waiting for TPM cooldown', { waitMs, currentTokens: this.minuteTokenCount });
        await sleep(waitMs);
      }
      this.minuteTokenCount = 0;
      this.minuteStart = Date.now();
    }

    this.requestTimestamps.push(Date.now());
    this.minuteTokenCount += estimatedInputTokens;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Estimate input token count from a messages array.
 * Rough heuristic: 1 token per 4 characters of serialized JSON.
 */
export function estimateTokens(messages: any[]): number {
  const text = JSON.stringify(messages);
  return Math.ceil(text.length / 4);
}

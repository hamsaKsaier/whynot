/**
 * k6-parser.ts
 *
 * Parses k6 JSON output (from --out json=-) streamed via stdout.
 *
 * Error rate philosophy:
 * - Only 5xx (server errors) count as "errors" — these mean the server is broken
 * - 4xx (client errors like 401, 422) mean the server is WORKING correctly
 *   (rejecting bad input as expected)
 * - Status code breakdown is tracked separately so users see the full picture
 */

export interface K6Metric {
  timestamp: string;
  vus: number;
  requests: number;
  failed: number;        // 5xx server errors only
  clientErrors: number;  // 4xx responses
  successful: number;    // 2xx + 3xx
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;     // 5xx / total — the real error rate
}

export interface K6Summary {
  totalRequests: number;
  failedRequests: number;    // 5xx only
  clientErrors: number;      // 4xx
  successfulRequests: number; // 2xx + 3xx
  avgResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p90ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  maxResponseTimeMs: number;
  minResponseTimeMs: number;
  requestsPerSecond: number;
  thresholdResults: Record<string, { passed: boolean; actual: string }>;
}

export class K6MetricsAggregator {
  private responseTimes: number[] = [];
  private totalRequests = 0;
  private serverErrors = 0;  // 5xx
  private clientErrors = 0;  // 4xx
  private successful = 0;    // 2xx + 3xx
  private currentVUs = 0;
  private startTime: number | null = null;
  private thresholdResults: Record<string, { passed: boolean; actual: string }> = {};

  parseLine(line: string): K6Metric | null {
    try {
      const data = JSON.parse(line);

      if (data.type === 'Point') {
        const metric = data.metric;
        const value = data.data?.value;

        if (!this.startTime) {
          this.startTime = Date.now();
        }

        switch (metric) {
          case 'http_req_duration':
            this.responseTimes.push(value);
            this.totalRequests++;
            return this.getCurrentSnapshot();

          // Track our custom counters from the k6 script
          case 'server_errors':
            this.serverErrors += value;
            break;
          case 'client_errors':
            this.clientErrors += value;
            break;
          case 'success_count':
            this.successful += value;
            break;

          case 'vus':
            this.currentVUs = value;
            break;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.floor(sorted.length * p);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  getCurrentSnapshot(): K6Metric {
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 1;
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const avg = sorted.length > 0
      ? sorted.reduce((a, b) => a + b, 0) / sorted.length
      : 0;

    return {
      timestamp: new Date().toISOString(),
      vus: this.currentVUs,
      requests: this.totalRequests,
      failed: this.serverErrors,
      clientErrors: this.clientErrors,
      successful: this.successful,
      avgResponseTime: Math.round(avg * 100) / 100,
      p50ResponseTime: Math.round(this.percentile(sorted, 0.5) * 100) / 100,
      p95ResponseTime: Math.round(this.percentile(sorted, 0.95) * 100) / 100,
      p99ResponseTime: Math.round(this.percentile(sorted, 0.99) * 100) / 100,
      requestsPerSecond: Math.round((this.totalRequests / elapsed) * 100) / 100,
      // Error rate = server errors only / total requests
      errorRate: this.totalRequests > 0
        ? Math.round((this.serverErrors / this.totalRequests) * 10000) / 100
        : 0,
    };
  }

  parseStdoutLine(line: string): void {
    const passMatch = line.match(/✓\s+(\S+)/);
    const failMatch = line.match(/✗\s+(\S+)/);
    if (passMatch) {
      this.thresholdResults[passMatch[1]] = { passed: true, actual: line.trim() };
    } else if (failMatch) {
      this.thresholdResults[failMatch[1]] = { passed: false, actual: line.trim() };
    }
  }

  getSummary(): K6Summary {
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const len = sorted.length;
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 1;

    return {
      totalRequests: this.totalRequests,
      failedRequests: this.serverErrors,
      clientErrors: this.clientErrors,
      successfulRequests: this.successful,
      avgResponseTimeMs: len > 0
        ? Math.round((sorted.reduce((a, b) => a + b, 0) / len) * 100) / 100
        : 0,
      p50ResponseTimeMs: Math.round(this.percentile(sorted, 0.5) * 100) / 100,
      p90ResponseTimeMs: Math.round(this.percentile(sorted, 0.9) * 100) / 100,
      p95ResponseTimeMs: Math.round(this.percentile(sorted, 0.95) * 100) / 100,
      p99ResponseTimeMs: Math.round(this.percentile(sorted, 0.99) * 100) / 100,
      maxResponseTimeMs: len > 0 ? Math.round(sorted[len - 1] * 100) / 100 : 0,
      minResponseTimeMs: len > 0 ? Math.round(sorted[0] * 100) / 100 : 0,
      requestsPerSecond: Math.round((this.totalRequests / elapsed) * 100) / 100,
      thresholdResults: this.thresholdResults,
    };
  }
}

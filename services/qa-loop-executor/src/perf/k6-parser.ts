/**
 * k6-parser.ts
 *
 * Parses k6 JSON output (from --out json=-) streamed via stdout.
 * Aggregates metrics for real-time streaming and final summaries.
 *
 * Error counting: k6's built-in http_req_failed marks any status >= 400
 * as failed. We track both total requests and failures ourselves to
 * ensure the error rate matches what users see.
 */

export interface K6Metric {
  timestamp: string;
  vus: number;
  requests: number;
  failed: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
}

export interface K6Summary {
  totalRequests: number;
  failedRequests: number;
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
  // Count requests from http_req_duration points (1 per completed request)
  private totalRequests = 0;
  // Count failures from http_req_failed points (value=1 means status >= 400)
  private failedRequests = 0;
  // Track total http_req_failed points to compute rate correctly
  private totalFailedPoints = 0;
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

          case 'http_req_failed':
            // k6 emits one point per request: value=0 (success) or value=1 (status >= 400)
            this.totalFailedPoints++;
            if (value === 1) {
              this.failedRequests++;
            }
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

    // Use totalFailedPoints as denominator if available (more accurate than totalRequests
    // since http_req_failed fires exactly once per request with 0 or 1)
    const errorDenominator = this.totalFailedPoints > 0 ? this.totalFailedPoints : this.totalRequests;

    return {
      timestamp: new Date().toISOString(),
      vus: this.currentVUs,
      requests: this.totalRequests,
      failed: this.failedRequests,
      avgResponseTime: Math.round(avg * 100) / 100,
      p50ResponseTime: Math.round(this.percentile(sorted, 0.5) * 100) / 100,
      p95ResponseTime: Math.round(this.percentile(sorted, 0.95) * 100) / 100,
      p99ResponseTime: Math.round(this.percentile(sorted, 0.99) * 100) / 100,
      requestsPerSecond: Math.round((this.totalRequests / elapsed) * 100) / 100,
      errorRate: errorDenominator > 0
        ? Math.round((this.failedRequests / errorDenominator) * 10000) / 100
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
      failedRequests: this.failedRequests,
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

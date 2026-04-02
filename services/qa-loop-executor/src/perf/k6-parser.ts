/**
 * k6-parser.ts
 *
 * Parses k6 JSON output (from --out json) line by line.
 * Aggregates metrics for real-time streaming and final summaries.
 */

export interface K6Metric {
  timestamp: string;
  vus: number;
  requests: number;
  failed: number;
  avgResponseTime: number;
  p95ResponseTime: number;
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
  private totalRequests = 0;
  private failedRequests = 0;
  private currentVUs = 0;
  private startTime: number | null = null;
  private lastEmitTime = 0;
  private thresholdResults: Record<string, { passed: boolean; actual: string }> = {};

  /**
   * Parse a single line of k6 JSON output.
   * k6 outputs one JSON object per line with metric data points.
   */
  parseLine(line: string): K6Metric | null {
    try {
      const data = JSON.parse(line);

      if (data.type === 'Point') {
        this.handleDataPoint(data);
      } else if (data.type === 'Metric') {
        // Metric definition — can be used for threshold evaluation
        return null;
      }

      // Emit aggregated metric at most every 1 second
      const now = Date.now();
      if (now - this.lastEmitTime >= 1000) {
        this.lastEmitTime = now;
        return this.getCurrentSnapshot();
      }

      return null;
    } catch {
      // Not JSON or unparseable — skip
      return null;
    }
  }

  private handleDataPoint(data: any): void {
    const metric = data.metric;
    const value = data.data?.value;

    if (!this.startTime) {
      this.startTime = Date.now();
    }

    switch (metric) {
      case 'http_reqs':
        this.totalRequests += value;
        break;
      case 'http_req_failed':
        if (value === 1) this.failedRequests++;
        break;
      case 'http_req_duration':
        this.responseTimes.push(value);
        break;
      case 'vus':
        this.currentVUs = value;
        break;
    }
  }

  getCurrentSnapshot(): K6Metric {
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 1;
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const avg = sorted.length > 0
      ? sorted.reduce((a, b) => a + b, 0) / sorted.length
      : 0;
    const p95 = sorted.length > 0
      ? sorted[Math.floor(sorted.length * 0.95)] || 0
      : 0;

    return {
      timestamp: new Date().toISOString(),
      vus: this.currentVUs,
      requests: this.totalRequests,
      failed: this.failedRequests,
      avgResponseTime: Math.round(avg * 100) / 100,
      p95ResponseTime: Math.round(p95 * 100) / 100,
      requestsPerSecond: Math.round((this.totalRequests / elapsed) * 100) / 100,
      errorRate: this.totalRequests > 0
        ? Math.round((this.failedRequests / this.totalRequests) * 10000) / 100
        : 0,
    };
  }

  /**
   * Parse k6 stdout for threshold pass/fail results.
   * k6 prints threshold results in its text summary output.
   */
  parseStdoutLine(line: string): void {
    // k6 threshold output format: "  ✓ http_req_duration..........: avg=245ms min=12ms ..."
    // or "  ✗ http_req_failed............: 2.50% ✗ 0"
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

    const percentile = (p: number) => len > 0 ? sorted[Math.floor(len * p)] || 0 : 0;

    return {
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      avgResponseTimeMs: len > 0
        ? Math.round((sorted.reduce((a, b) => a + b, 0) / len) * 100) / 100
        : 0,
      p50ResponseTimeMs: Math.round(percentile(0.5) * 100) / 100,
      p90ResponseTimeMs: Math.round(percentile(0.9) * 100) / 100,
      p95ResponseTimeMs: Math.round(percentile(0.95) * 100) / 100,
      p99ResponseTimeMs: Math.round(percentile(0.99) * 100) / 100,
      maxResponseTimeMs: len > 0 ? Math.round(sorted[len - 1] * 100) / 100 : 0,
      minResponseTimeMs: len > 0 ? Math.round(sorted[0] * 100) / 100 : 0,
      requestsPerSecond: Math.round((this.totalRequests / elapsed) * 100) / 100,
      thresholdResults: this.thresholdResults,
    };
  }
}

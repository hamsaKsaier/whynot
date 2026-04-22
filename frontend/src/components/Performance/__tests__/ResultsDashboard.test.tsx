import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import fs from 'fs';
import path from 'path';
import type { PerfSummary } from '../../../hooks/usePerfStream';

// ---------------------------------------------------------------------------
// Translation loader
// ---------------------------------------------------------------------------

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');

function loadJson(lang: string, ns: string): Record<string, string> {
  const filePath = path.join(LOCALES_DIR, lang, `${ns}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ---------------------------------------------------------------------------
// Mutable language used by the mock
// ---------------------------------------------------------------------------

let currentLang = 'en';

// ---------------------------------------------------------------------------
// Mock react-i18next
// ---------------------------------------------------------------------------

const mockUseTranslation = () => {
  const translations = loadJson(currentLang, 'runner');
  const t = (key: string, opts?: Record<string, unknown>) => {
    let value = translations[key] ?? key;
    if (opts) {
      for (const [k, v] of Object.entries(opts)) {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
    }
    return value;
  };
  return { t, i18n: { language: currentLang } };
};

vi.mock('react-i18next', () => ({
  useTranslation: () => mockUseTranslation(),
}));

// ---------------------------------------------------------------------------
// Mock i18next (used by ChartErrorBoundary)
// ---------------------------------------------------------------------------

vi.mock('i18next', () => ({
  default: { t: (key: string) => key },
}));

// ---------------------------------------------------------------------------
// Mock recharts (jsdom cannot render SVG canvas)
// ---------------------------------------------------------------------------

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

// ---------------------------------------------------------------------------
// Mock react-icons/fi (optional: avoids potential SVG issues in jsdom)
// ---------------------------------------------------------------------------

vi.mock('react-icons/fi', () => ({
  FiSquare: () => <span data-testid="icon-square" />,
  FiCheckCircle: () => <span data-testid="icon-check" />,
  FiXCircle: () => <span data-testid="icon-x" />,
  FiAlertTriangle: () => <span data-testid="icon-alert" />,
  FiRefreshCw: () => <span data-testid="icon-refresh" />,
}));

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks
// ---------------------------------------------------------------------------

import { ResultsDashboard } from '../ResultsDashboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;

const makeSummary = (overrides: Partial<PerfSummary> = {}): PerfSummary => ({
  totalRequests: 100,
  failedRequests: 0,
  successfulRequests: 100,
  avgResponseTimeMs: 150,
  p50ResponseTimeMs: 120,
  p90ResponseTimeMs: 250,
  p95ResponseTimeMs: 400,
  p99ResponseTimeMs: 500,
  minResponseTimeMs: 50,
  maxResponseTimeMs: 600,
  requestsPerSecond: 50,
  thresholdResults: {},
  ...overrides,
});

const defaultProps = {
  isRunning: false,
  isComplete: true,
  currentMetric: null,
  metricHistory: [],
  testType: 'load',
  targetUrl: 'https://api.example.com',
  startedAt: '2024-01-01T00:00:00Z',
  onStop: vi.fn(),
};

/**
 * Interpolate a translation template with the given values,
 * mirroring the logic in getVerdict.
 *
 * Also normalises non-breaking spaces (\u00a0) to regular spaces so that
 * the expected string matches what @testing-library's default text
 * normaliser produces (it collapses all whitespace, including \u00a0).
 */
function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  // Normalise non-breaking spaces to regular spaces (matches testing-library)
  result = result.replace(/\u00a0/g, ' ');
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResultsDashboard i18n', () => {
  for (const lang of LANGUAGES) {
    describe(`locale: ${lang}`, () => {
      let translations: Record<string, string>;

      beforeEach(() => {
        currentLang = lang;
        translations = loadJson(lang, 'runner');
      });

      // ── Branch 1: pass / okLatency ──────────────────────────────────
      it('renders pass verdict with okLatency headline', () => {
        const summary = makeSummary();
        render(<ResultsDashboard {...defaultProps} summary={summary} />);

        const expectedHeadline = interpolate(
          translations['runner.performance.verdict.okLatency'],
          { rps: '50', avgMs: '150' },
        );
        expect(screen.getByText(expectedHeadline)).toBeInTheDocument();
      });

      it('renders goodAvg detail for pass verdict', () => {
        const summary = makeSummary();
        render(<ResultsDashboard {...defaultProps} summary={summary} />);

        const expectedDetail = interpolate(
          translations['runner.performance.verdict.goodAvg'],
          { avgMs: '150' },
        );
        expect(screen.getByText(expectedDetail)).toBeInTheDocument();
      });

      it('renders successRate detail for pass verdict', () => {
        const summary = makeSummary();
        render(<ResultsDashboard {...defaultProps} summary={summary} />);

        // toLocaleString may format differently, but with 100 requests it stays "100"
        const expectedDetail = interpolate(
          translations['runner.performance.verdict.successRate'],
          { totalRequests: (100).toLocaleString(), successPct: '100' },
        );
        expect(screen.getByText(expectedDetail)).toBeInTheDocument();
      });

      // ── Branch 2: fail / highErrorRate ──────────────────────────────
      it('renders fail verdict with highErrorRate detail', () => {
        const summary = makeSummary({
          failedRequests: 10,
          successfulRequests: 90,
        });
        render(<ResultsDashboard {...defaultProps} summary={summary} />);

        const expectedHeadline = translations['runner.performance.verdict.failHeadline'];
        expect(screen.getByText(expectedHeadline)).toBeInTheDocument();

        const errorRate = ((10 / 100) * 100).toFixed(1); // "10.0"
        const expectedDetail = interpolate(
          translations['runner.performance.verdict.highErrorRate'],
          { errorPct: errorRate },
        );
        expect(screen.getByText(expectedDetail)).toBeInTheDocument();
      });

      // ── Branch 3: warning / moderateErrorRate ───────────────────────
      it('renders warning verdict with moderateErrorRate detail', () => {
        // 3% error rate: 1 < 3 <= 5
        const summary = makeSummary({
          failedRequests: 3,
          successfulRequests: 97,
        });
        render(<ResultsDashboard {...defaultProps} summary={summary} />);

        const expectedHeadline = translations['runner.performance.verdict.warningHeadline'];
        expect(screen.getByText(expectedHeadline)).toBeInTheDocument();

        const errorRate = ((3 / 100) * 100).toFixed(1); // "3.0"
        const expectedDetail = interpolate(
          translations['runner.performance.verdict.moderateErrorRate'],
          { errorPct: errorRate },
        );
        expect(screen.getByText(expectedDetail)).toBeInTheDocument();
      });

      // ── Branch 4: fail / slowP95 ───────────────────────────────────
      it('renders fail verdict with slowP95 detail', () => {
        const summary = makeSummary({
          p95ResponseTimeMs: 6000,
          p99ResponseTimeMs: 8000,
          maxResponseTimeMs: 10000,
        });
        render(<ResultsDashboard {...defaultProps} summary={summary} />);

        const expectedHeadline = translations['runner.performance.verdict.failHeadline'];
        expect(screen.getByText(expectedHeadline)).toBeInTheDocument();

        const seconds = (6000 / 1000).toFixed(1); // "6.0"
        const expectedDetail = interpolate(
          translations['runner.performance.verdict.slowP95'],
          { seconds },
        );
        expect(screen.getByText(expectedDetail)).toBeInTheDocument();
      });

      // ── Branch 5: warning / moderateP95 ────────────────────────────
      it('renders warning verdict with moderateP95 detail', () => {
        // p95 = 3000 (2000 < 3000 <= 5000)
        const summary = makeSummary({
          p95ResponseTimeMs: 3000,
          p99ResponseTimeMs: 3500,
          maxResponseTimeMs: 4000,
        });
        render(<ResultsDashboard {...defaultProps} summary={summary} />);

        const expectedHeadline = translations['runner.performance.verdict.warningHeadline'];
        expect(screen.getByText(expectedHeadline)).toBeInTheDocument();

        const expectedDetail = interpolate(
          translations['runner.performance.verdict.moderateP95'],
          { ms: String(Math.round(3000)) },
        );
        expect(screen.getByText(expectedDetail)).toBeInTheDocument();
      });

      // ── Branch 6: warning / spikyP99 ──────────────────────────────
      it('renders warning verdict with spikyP99 detail', () => {
        // p99 > p95*3 && p99 > 1000
        // p95 = 400, p99 = 1500 => 1500 > 400*3 (1200) && 1500 > 1000
        const summary = makeSummary({
          p95ResponseTimeMs: 400,
          p99ResponseTimeMs: 1500,
          maxResponseTimeMs: 2000,
        });
        render(<ResultsDashboard {...defaultProps} summary={summary} />);

        const expectedHeadline = translations['runner.performance.verdict.warningHeadline'];
        expect(screen.getByText(expectedHeadline)).toBeInTheDocument();

        const expectedDetail = interpolate(
          translations['runner.performance.verdict.spikyP99'],
          { ms: String(Math.round(1500)) },
        );
        expect(screen.getByText(expectedDetail)).toBeInTheDocument();
      });
    });
  }

  // ── Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    beforeEach(() => {
      currentLang = 'en';
    });

    it('handles 0 total requests without crashing', () => {
      const summary = makeSummary({
        totalRequests: 0,
        failedRequests: 0,
        successfulRequests: 0,
        requestsPerSecond: 0,
        avgResponseTimeMs: 0,
        p50ResponseTimeMs: 0,
        p90ResponseTimeMs: 0,
        p95ResponseTimeMs: 0,
        p99ResponseTimeMs: 0,
        minResponseTimeMs: 0,
        maxResponseTimeMs: 0,
      });

      // Should not throw
      const { container } = render(
        <ResultsDashboard {...defaultProps} summary={summary} />,
      );
      expect(container).toBeTruthy();

      // With 0 requests errorRate is 0, p95 is 0 => pass verdict
      const translations = loadJson('en', 'runner');
      const expectedHeadline = interpolate(
        translations['runner.performance.verdict.okLatency'],
        { rps: '0.0', avgMs: '0' },
      );
      expect(screen.getByText(expectedHeadline)).toBeInTheDocument();
    });

    it('handles 100% error rate', () => {
      const summary = makeSummary({
        totalRequests: 50,
        failedRequests: 50,
        successfulRequests: 0,
        requestsPerSecond: 10,
        avgResponseTimeMs: 200,
      });

      render(<ResultsDashboard {...defaultProps} summary={summary} />);

      const translations = loadJson('en', 'runner');
      // 100% error rate => fail
      const expectedHeadline = translations['runner.performance.verdict.failHeadline'];
      expect(screen.getByText(expectedHeadline)).toBeInTheDocument();

      const errorRate = ((50 / 50) * 100).toFixed(1); // "100.0"
      const expectedDetail = interpolate(
        translations['runner.performance.verdict.highErrorRate'],
        { errorPct: errorRate },
      );
      expect(screen.getByText(expectedDetail)).toBeInTheDocument();
    });

    it('handles sub-millisecond latency', () => {
      const summary = makeSummary({
        avgResponseTimeMs: 0.3,
        p50ResponseTimeMs: 0.2,
        p90ResponseTimeMs: 0.4,
        p95ResponseTimeMs: 0.5,
        p99ResponseTimeMs: 0.6,
        minResponseTimeMs: 0.1,
        maxResponseTimeMs: 0.8,
        requestsPerSecond: 5000,
      });

      render(<ResultsDashboard {...defaultProps} summary={summary} />);

      const translations = loadJson('en', 'runner');
      // rps >= 1 so Math.round(5000).toString() = "5000"
      // avgMs = Math.round(0.3) = 0
      const expectedHeadline = interpolate(
        translations['runner.performance.verdict.okLatency'],
        { rps: '5000', avgMs: '0' },
      );
      expect(screen.getByText(expectedHeadline)).toBeInTheDocument();
    });

    it('handles sub-1 rps with decimal formatting', () => {
      const summary = makeSummary({
        requestsPerSecond: 0.5,
      });

      render(<ResultsDashboard {...defaultProps} summary={summary} />);

      const translations = loadJson('en', 'runner');
      // rps < 1 => toFixed(1) = "0.5"
      const expectedHeadline = interpolate(
        translations['runner.performance.verdict.okLatency'],
        { rps: '0.5', avgMs: '150' },
      );
      expect(screen.getByText(expectedHeadline)).toBeInTheDocument();
    });

    it('combines highErrorRate and slowP95 into fail with multiple details', () => {
      const summary = makeSummary({
        totalRequests: 100,
        failedRequests: 20,
        successfulRequests: 80,
        p95ResponseTimeMs: 7000,
        p99ResponseTimeMs: 9000,
        maxResponseTimeMs: 12000,
      });

      render(<ResultsDashboard {...defaultProps} summary={summary} />);

      const translations = loadJson('en', 'runner');
      const expectedHeadline = translations['runner.performance.verdict.failHeadline'];
      expect(screen.getByText(expectedHeadline)).toBeInTheDocument();

      // Both detail lines should appear
      const errorDetail = interpolate(
        translations['runner.performance.verdict.highErrorRate'],
        { errorPct: '20.0' },
      );
      expect(screen.getByText(errorDetail)).toBeInTheDocument();

      const p95Detail = interpolate(
        translations['runner.performance.verdict.slowP95'],
        { seconds: '7.0' },
      );
      expect(screen.getByText(p95Detail)).toBeInTheDocument();
    });

    it('combines moderateErrorRate and spikyP99 into warning with multiple details', () => {
      // 2% error rate (moderate) + spiky p99
      const summary = makeSummary({
        totalRequests: 100,
        failedRequests: 2,
        successfulRequests: 98,
        p95ResponseTimeMs: 400,
        p99ResponseTimeMs: 1500,
        maxResponseTimeMs: 2000,
      });

      render(<ResultsDashboard {...defaultProps} summary={summary} />);

      const translations = loadJson('en', 'runner');
      const expectedHeadline = translations['runner.performance.verdict.warningHeadline'];
      expect(screen.getByText(expectedHeadline)).toBeInTheDocument();

      const errorDetail = interpolate(
        translations['runner.performance.verdict.moderateErrorRate'],
        { errorPct: '2.0' },
      );
      expect(screen.getByText(errorDetail)).toBeInTheDocument();

      const spikyDetail = interpolate(
        translations['runner.performance.verdict.spikyP99'],
        { ms: '1500' },
      );
      expect(screen.getByText(spikyDetail)).toBeInTheDocument();
    });

    it('does not render verdict banner when isComplete is false', () => {
      const summary = makeSummary();
      render(
        <ResultsDashboard
          {...defaultProps}
          isComplete={false}
          isRunning={true}
          summary={summary}
        />,
      );

      const translations = loadJson('en', 'runner');
      const passHeadline = interpolate(
        translations['runner.performance.verdict.okLatency'],
        { rps: '50', avgMs: '150' },
      );
      expect(screen.queryByText(passHeadline)).not.toBeInTheDocument();
    });

    it('does not render verdict banner when summary is null', () => {
      render(
        <ResultsDashboard
          {...defaultProps}
          isComplete={true}
          summary={null}
        />,
      );

      const translations = loadJson('en', 'runner');
      // None of the verdict headlines should be present
      expect(
        screen.queryByText(translations['runner.performance.verdict.failHeadline']),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(translations['runner.performance.verdict.warningHeadline']),
      ).not.toBeInTheDocument();
    });
  });
});

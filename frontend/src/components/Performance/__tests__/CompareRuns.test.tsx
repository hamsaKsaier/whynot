import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import fs from 'fs';
import path from 'path';
import type { PerfRun } from '../../../services/perf-api';

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
// Mock react-icons/fi
// ---------------------------------------------------------------------------

vi.mock('react-icons/fi', () => ({
  FiArrowUp: () => <span data-testid="icon-arrow-up" />,
  FiArrowDown: () => <span data-testid="icon-arrow-down" />,
  FiMinus: () => <span data-testid="icon-minus" />,
}));

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks
// ---------------------------------------------------------------------------

import { CompareRuns } from '../CompareRuns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;

const FIXED_TIMESTAMP = '2024-06-15T14:30:00Z';

function makeRun(overrides: Partial<PerfRun> = {}): PerfRun {
  return {
    id: 'run-1',
    project_id: null,
    workspace_id: 'ws-1',
    test_type: 'load',
    target_url: 'https://api.example.com',
    method: 'GET',
    config: {},
    status: 'completed',
    started_at: FIXED_TIMESTAMP,
    completed_at: FIXED_TIMESTAMP,
    duration_ms: 60000,
    total_requests: 1000,
    failed_requests: 5,
    avg_response_time_ms: 150,
    p50_response_time_ms: 120,
    p90_response_time_ms: 250,
    p95_response_time_ms: 400,
    p99_response_time_ms: 600,
    max_response_time_ms: 800,
    min_response_time_ms: 50,
    requests_per_second: 50,
    raw_metrics: null,
    created_at: FIXED_TIMESTAMP,
    ...overrides,
  };
}

const runA = makeRun({ id: 'run-a', total_requests: 1000, avg_response_time_ms: 150, p95_response_time_ms: 400, p99_response_time_ms: 600, requests_per_second: 50, failed_requests: 5 });
const runB = makeRun({ id: 'run-b', total_requests: 1200, avg_response_time_ms: 130, p95_response_time_ms: 350, p99_response_time_ms: 550, requests_per_second: 60, failed_requests: 3 });
const onClose = vi.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompareRuns i18n', () => {
  for (const lang of LANGUAGES) {
    describe(`locale: ${lang}`, () => {
      let translations: Record<string, string>;

      beforeEach(() => {
        currentLang = lang;
        translations = loadJson(lang, 'runner');
        onClose.mockClear();
      });

      // ── Date formatting ──────────────────────────────────────────────
      it('renders locale-aware formatted dates', () => {
        render(<CompareRuns runA={runA} runB={runB} onClose={onClose} />);

        const expectedDate = new Date(FIXED_TIMESTAMP).toLocaleString(lang, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        const dateElements = screen.getAllByText(expectedDate);
        // Both runA and runB use the same timestamp, so expect at least 2
        expect(dateElements.length).toBeGreaterThanOrEqual(2);
      });

      // ── Translated metric labels ─────────────────────────────────────
      it('renders translated "Compare Runs" heading', () => {
        render(<CompareRuns runA={runA} runB={runB} onClose={onClose} />);
        expect(screen.getByText(translations['runner.performance.compareRuns'])).toBeInTheDocument();
      });

      it('renders translated "Close" button', () => {
        render(<CompareRuns runA={runA} runB={runB} onClose={onClose} />);
        expect(screen.getByText(translations['runner.performance.close'])).toBeInTheDocument();
      });

      it('renders translated "Metric" column header', () => {
        render(<CompareRuns runA={runA} runB={runB} onClose={onClose} />);
        expect(screen.getByText(translations['runner.performance.metric'])).toBeInTheDocument();
      });

      it('renders translated "Change" column header', () => {
        render(<CompareRuns runA={runA} runB={runB} onClose={onClose} />);
        expect(screen.getByText(translations['runner.performance.change'])).toBeInTheDocument();
      });

      it('renders translated metric row labels', () => {
        render(<CompareRuns runA={runA} runB={runB} onClose={onClose} />);

        expect(screen.getByText(translations['runner.performance.totalRequests'])).toBeInTheDocument();
        expect(screen.getByText(translations['runner.performance.avgResponseTime'])).toBeInTheDocument();
        expect(screen.getByText(translations['runner.performance.p95ResponseTime'])).toBeInTheDocument();
        expect(screen.getByText(translations['runner.performance.p99ResponseTime'])).toBeInTheDocument();
        expect(screen.getByText(translations['runner.performance.throughputReqS'])).toBeInTheDocument();
        expect(screen.getByText(translations['runner.performance.errorRate'])).toBeInTheDocument();
      });
    });
  }
});

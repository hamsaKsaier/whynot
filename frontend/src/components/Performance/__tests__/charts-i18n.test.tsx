import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import type { PerfMetric } from '../../../hooks/usePerfStream';

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;

function loadJson(lang: string, ns: string): Record<string, string> {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, lang, `${ns}.json`), 'utf-8'));
}

let currentLang = 'en';

vi.mock('react-i18next', () => ({
  useTranslation: () => {
    const translations = loadJson(currentLang, 'runner');
    const t = (key: string, opts?: Record<string, any>) => {
      let value = translations[key] ?? key;
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
      }
      return value;
    };
    return { t, i18n: { language: currentLang } };
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  ComposedChart: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { ResponseTimeChart } from '../ResponseTimeChart';
import { RPSChart } from '../RPSChart';
import { VirtualUsersChart } from '../VirtualUsersChart';

const SAMPLE_DATA: PerfMetric[] = [
  {
    timestamp: '2026-01-01T00:00:00Z',
    vus: 10,
    requests: 100,
    failed: 2,
    successful: 98,
    avgResponseTime: 120,
    p50ResponseTime: 100,
    p95ResponseTime: 250,
    p99ResponseTime: 400,
    requestsPerSecond: 50,
    errorRate: 0.02,
  },
  {
    timestamp: '2026-01-01T00:00:01Z',
    vus: 15,
    requests: 150,
    failed: 3,
    successful: 147,
    avgResponseTime: 130,
    p50ResponseTime: 110,
    p95ResponseTime: 270,
    p99ResponseTime: 420,
    requestsPerSecond: 55,
    errorRate: 0.02,
  },
];

describe('Chart components i18n compliance', () => {
  beforeEach(() => {
    currentLang = 'en';
  });

  describe('ResponseTimeChart', () => {
    describe.each(LANGUAGES)('locale: %s', (lang) => {
      it('renders translated chart title', () => {
        currentLang = lang;
        const translations = loadJson(lang, 'runner');

        render(<ResponseTimeChart data={SAMPLE_DATA} />);

        const expectedTitle = translations['runner.performance.responseTimeMs'];
        expect(expectedTitle).toBeDefined();

        const heading = screen.getByRole('heading', { level: 3 });
        expect(heading).toHaveTextContent(expectedTitle);
      });

      it('renders without errors', () => {
        currentLang = lang;
        expect(() => render(<ResponseTimeChart data={SAMPLE_DATA} />)).not.toThrow();
      });
    });
  });

  describe('RPSChart', () => {
    describe.each(LANGUAGES)('locale: %s', (lang) => {
      it('renders translated chart title', () => {
        currentLang = lang;
        const translations = loadJson(lang, 'runner');

        render(<RPSChart data={SAMPLE_DATA} />);

        const expectedTitle = translations['runner.performance.requestsPerSecond'];
        expect(expectedTitle).toBeDefined();

        const heading = screen.getByRole('heading', { level: 3 });
        expect(heading).toHaveTextContent(expectedTitle);
      });

      it('renders without errors', () => {
        currentLang = lang;
        expect(() => render(<RPSChart data={SAMPLE_DATA} />)).not.toThrow();
      });
    });
  });

  describe('VirtualUsersChart', () => {
    describe.each(LANGUAGES)('locale: %s', (lang) => {
      it('renders translated chart title', () => {
        currentLang = lang;
        const translations = loadJson(lang, 'runner');

        render(<VirtualUsersChart data={SAMPLE_DATA} />);

        const expectedTitle = translations['runner.performance.virtualUsers'];
        expect(expectedTitle).toBeDefined();

        const heading = screen.getByRole('heading', { level: 3 });
        expect(heading).toHaveTextContent(expectedTitle);
      });

      it('renders without errors', () => {
        currentLang = lang;
        expect(() => render(<VirtualUsersChart data={SAMPLE_DATA} />)).not.toThrow();
      });
    });
  });
});

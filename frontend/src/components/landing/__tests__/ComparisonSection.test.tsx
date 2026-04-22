import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { ComparisonSection } from '../ComparisonSection';

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
const NAMESPACES = ['common', 'landing'];

const resources: Record<string, Record<string, unknown>> = {};
for (const lang of LANGUAGES) {
  resources[lang] = {};
  for (const ns of NAMESPACES) {
    const filePath = path.join(LOCALES_DIR, lang, `${ns}.json`);
    if (fs.existsSync(filePath)) {
      resources[lang][ns] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }
}

const testI18n = i18next.createInstance();
testI18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  ns: NAMESPACES,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

function mockMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  });
}

beforeEach(() => {
  mockMatchMedia(false);

  globalThis.IntersectionObserver = vi.fn().mockImplementation((cb: IntersectionObserverCallback) => {
    const instance = {
      observe: vi.fn((target: Element) => {
        cb(
          [
            {
              isIntersecting: true,
              intersectionRatio: 1,
              target,
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRect: target.getBoundingClientRect(),
              rootBounds: null,
              time: Date.now(),
            } as IntersectionObserverEntry,
          ],
          instance as unknown as IntersectionObserver,
        );
      }),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: () => [],
    };
    return instance;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderComparison() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <ComparisonSection />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('ComparisonSection', () => {
  it('renders heading and subtitle', () => {
    renderComparison();
    expect(screen.getByText('How WhyNot compares')).toBeInTheDocument();
    expect(screen.getByText(/See why teams are switching/)).toBeInTheDocument();
  });

  it('renders all 6 competitor columns in desktop table', () => {
    renderComparison();
    const competitors = ['WhyNot', 'Selenium', 'Cypress', 'Playwright', 'BrowserStack', 'LambdaTest'];
    for (const name of competitors) {
      const matches = screen.getAllByText(name);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders 10 feature rows', () => {
    renderComparison();
    const features = [
      'AI autonomous exploration',
      'No-code setup',
      'Automatic bug detection',
      'Test code generation',
      'Visual regression testing',
      'Chaos testing',
      'CI/CD integration',
      'Multi-browser testing',
      'Self-healing tests',
      'Parallel execution',
    ];
    for (const feature of features) {
      const matches = screen.getAllByText(feature);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('WhyNot column cells have primary highlight', () => {
    renderComparison();
    const primaryCells = document.querySelectorAll('.bg-primary\\/5');
    expect(primaryCells.length).toBeGreaterThan(0);
  });

  it('desktop table uses proper th scope="col" for headers', () => {
    renderComparison();
    const colHeaders = document.querySelectorAll('th[scope="col"]');
    expect(colHeaders.length).toBeGreaterThanOrEqual(7);
  });

  it('desktop table uses proper th scope="row" for feature names', () => {
    renderComparison();
    const rowHeaders = document.querySelectorAll('th[scope="row"]');
    expect(rowHeaders.length).toBeGreaterThanOrEqual(10);
  });

  it('renders correct icons for yes/no/partial values', () => {
    renderComparison();
    const yesLabels = screen.getAllByLabelText('Yes');
    const noLabels = screen.getAllByLabelText('No');
    const partialTexts = screen.getAllByText('Partial');
    expect(yesLabels.length).toBeGreaterThan(0);
    expect(noLabels.length).toBeGreaterThan(0);
    expect(partialTexts.length).toBeGreaterThan(0);
  });

  it('mobile table has sticky first column', () => {
    renderComparison();
    const stickyHeaders = document.querySelectorAll('th.sticky');
    expect(stickyHeaders.length).toBeGreaterThan(0);
  });

  it('renders mobile hint text', () => {
    renderComparison();
    expect(screen.getByText('Scroll to see more')).toBeInTheDocument();
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('renders all content without motion', () => {
      renderComparison();
      expect(screen.getByText('How WhyNot compares')).toBeInTheDocument();
      expect(screen.getAllByText('WhyNot').length).toBeGreaterThanOrEqual(1);
    });

    it('still renders all 10 feature rows', () => {
      renderComparison();
      const rowHeaders = document.querySelectorAll('th[scope="row"]');
      expect(rowHeaders.length).toBeGreaterThanOrEqual(10);
    });
  });
});

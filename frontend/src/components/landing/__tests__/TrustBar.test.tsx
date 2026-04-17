import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { TrustBar } from '../TrustBar';

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

function renderTrustBar(lng = 'en') {
  testI18n.changeLanguage(lng);
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <TrustBar />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('TrustBar', () => {
  it('renders 4 trust badges', () => {
    renderTrustBar();
    expect(screen.getAllByText('SOC 2 Compliant').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Data encrypted at rest').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('30-day money-back guarantee').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('99.9% uptime SLA').length).toBeGreaterThanOrEqual(1);
  });

  it('renders 4 stat labels', () => {
    renderTrustBar();
    expect(screen.getByText('Bugs found')).toBeInTheDocument();
    expect(screen.getByText('Tests generated')).toBeInTheDocument();
    expect(screen.getByText('Teams using WhyNot')).toBeInTheDocument();
    expect(screen.getByText('Detection accuracy')).toBeInTheDocument();
  });

  it('renders CountUp components with data-motion attribute', () => {
    renderTrustBar();
    const countUps = document.querySelectorAll('[data-motion="count-up"]');
    expect(countUps.length).toBe(4);
  });

  it('renders marquee with data-motion attribute', () => {
    renderTrustBar();
    const marquee = document.querySelector('[data-motion="marquee"]');
    expect(marquee).toBeInTheDocument();
  });

  it('marquee pauses on mouseenter', () => {
    renderTrustBar();
    const marquee = document.querySelector('[data-motion="marquee"]') as HTMLElement;
    expect(marquee).toBeInTheDocument();
    fireEvent.mouseEnter(marquee);
    const inner = marquee.querySelector('[style*="animation"]') as HTMLElement;
    if (inner) {
      expect(inner.style.animationPlayState).toBe('paused');
    }
  });

  describe('locale number formatting', () => {
    for (const lng of LANGUAGES) {
      it(`renders stat values for ${lng}`, () => {
        renderTrustBar(lng);
        const countUps = document.querySelectorAll('[data-motion="count-up"]');
        expect(countUps.length).toBe(4);
      });
    }
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('renders marquee statically without animation', () => {
      renderTrustBar();
      const marquee = document.querySelector('[data-motion="marquee"]') as HTMLElement;
      expect(marquee).toBeInTheDocument();
      const animated = marquee.querySelector('[style*="animation"]');
      expect(animated).toBeNull();
    });

    it('renders CountUp with final values immediately', () => {
      renderTrustBar();
      const countUps = document.querySelectorAll('[data-motion="count-up"]');
      expect(countUps.length).toBe(4);
    });

    it('still renders all 4 badges', () => {
      renderTrustBar();
      expect(screen.getAllByText('SOC 2 Compliant').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Data encrypted at rest').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('30-day money-back guarantee').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('99.9% uptime SLA').length).toBeGreaterThanOrEqual(1);
    });
  });
});

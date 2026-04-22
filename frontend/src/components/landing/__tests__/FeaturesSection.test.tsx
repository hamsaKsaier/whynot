import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { FeaturesSection } from '../FeaturesSection';

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

function renderFeatures() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <FeaturesSection />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('FeaturesSection', () => {
  it('renders 8 feature cards', () => {
    renderFeatures();
    const titles = [
      'Autonomous AI Agents',
      'Intelligent Bug Detection',
      'Visual Regression Testing',
      'Playwright Code Generation',
      'Chaos Testing',
      'Multi-Browser Coverage',
      'Organized Test Suites',
      'Security Scanning',
    ];
    for (const title of titles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('each card has an icon', () => {
    renderFeatures();
    const cards = document.querySelectorAll('[data-motion="reveal"]');
    const cardCount = Array.from(cards).filter(
      (el) => el.querySelector('svg') !== null,
    ).length;
    expect(cardCount).toBeGreaterThanOrEqual(8);
  });

  it('each card has a description', () => {
    renderFeatures();
    expect(screen.getByText(/AI agents explore your app/)).toBeInTheDocument();
    expect(screen.getByText(/Automatically detects visual glitches/)).toBeInTheDocument();
  });

  it('renders heading and subheading', () => {
    renderFeatures();
    expect(screen.getByText('Everything you need to ship bug-free software')).toBeInTheDocument();
    expect(screen.getByText(/AI-powered autonomous testing/)).toBeInTheDocument();
  });

  it('renders tier badges for applicable features', () => {
    renderFeatures();
    const proBadges = screen.getAllByText('Pro');
    expect(proBadges.length).toBe(2);
    expect(screen.getByText('Managed')).toBeInTheDocument();
  });

  it('no card uses translate-y or scale on hover (class inspection)', () => {
    renderFeatures();
    const cards = document.querySelectorAll('[data-motion="reveal"]');
    for (const card of cards) {
      const classes = card.className;
      expect(classes).not.toMatch(/translate-y/);
      expect(classes).not.toMatch(/scale/);
      expect(classes).not.toMatch(/shadow-md/);
      expect(classes).not.toMatch(/shadow-lg/);
    }
  });

  it('uses responsive grid columns', () => {
    renderFeatures();
    const grid = document.querySelector('[data-motion="stagger"]');
    expect(grid?.className).toContain('grid-cols-1');
    expect(grid?.className).toContain('md:grid-cols-2');
    expect(grid?.className).toContain('lg:grid-cols-4');
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('renders without motion animations', () => {
      renderFeatures();
      expect(screen.getByText('Autonomous AI Agents')).toBeInTheDocument();
      expect(screen.getByText('Security Scanning')).toBeInTheDocument();
    });

    it('still renders all 8 cards', () => {
      renderFeatures();
      const titles = [
        'Autonomous AI Agents',
        'Intelligent Bug Detection',
        'Visual Regression Testing',
        'Playwright Code Generation',
        'Chaos Testing',
        'Multi-Browser Coverage',
        'Organized Test Suites',
        'Security Scanning',
      ];
      for (const title of titles) {
        expect(screen.getByText(title)).toBeInTheDocument();
      }
    });
  });
});

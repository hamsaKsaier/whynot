import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { CTASection } from '../CTASection';

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

function renderCTA() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <CTASection />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('CTASection', () => {
  it('renders heading and subheading', () => {
    renderCTA();
    expect(screen.getByText('Start finding bugs today')).toBeInTheDocument();
    expect(screen.getByText(/Join hundreds of teams/)).toBeInTheDocument();
  });

  it('renders 3 trust signals', () => {
    renderCTA();
    expect(screen.getByText('Free tier available')).toBeInTheDocument();
    expect(screen.getByText('No credit card required')).toBeInTheDocument();
    expect(screen.getByText('30-day money-back guarantee')).toBeInTheDocument();
  });

  it('renders Get started CTA button', () => {
    renderCTA();
    expect(screen.getByRole('button', { name: /get started free/i })).toBeInTheDocument();
  });

  it('uses bg-muted for the section background', () => {
    renderCTA();
    const section = document.querySelector('section');
    expect(section?.className).toContain('bg-muted');
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('renders without data-motion attributes', () => {
      renderCTA();
      const motionElements = document.querySelectorAll('[data-motion]');
      expect(motionElements.length).toBe(0);
    });

    it('still renders all trust signals', () => {
      renderCTA();
      expect(screen.getByText('Free tier available')).toBeInTheDocument();
      expect(screen.getByText('No credit card required')).toBeInTheDocument();
      expect(screen.getByText('30-day money-back guarantee')).toBeInTheDocument();
    });
  });
});

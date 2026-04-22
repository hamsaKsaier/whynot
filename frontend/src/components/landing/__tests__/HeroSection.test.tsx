import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { HeroSection } from '../HeroSection';

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

let mockIsAuthenticated = false;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

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
  mockIsAuthenticated = false;
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

function renderHero() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('HeroSection', () => {
  it('renders headline with word-stagger spans', () => {
    renderHero();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    const words = heading.querySelectorAll('span');
    expect(words.length).toBeGreaterThanOrEqual(2);
    expect(heading.textContent).toContain('Find\u00A0bugs');
    expect(heading.textContent).toContain('before\u00A0your\u00A0users\u00A0do');
  });

  it('renders eyebrow chip', () => {
    renderHero();
    expect(screen.getByText('AI-Powered QA')).toBeInTheDocument();
  });

  it('shows Get started CTA when unauthenticated', () => {
    mockIsAuthenticated = false;
    renderHero();
    expect(screen.getByRole('button', { name: /start free trial/i })).toBeInTheDocument();
  });

  it('shows Open app CTA when authenticated', () => {
    mockIsAuthenticated = true;
    renderHero();
    expect(screen.getByRole('button', { name: /open app/i })).toBeInTheDocument();
  });

  it('renders View pricing secondary CTA', () => {
    renderHero();
    expect(screen.getByRole('button', { name: /view pricing/i })).toBeInTheDocument();
  });

  it('renders video element with preload="metadata"', () => {
    renderHero();
    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video?.getAttribute('preload')).toBe('metadata');
  });

  it('renders no-credit-card text and social proof', () => {
    renderHero();
    expect(screen.getByText('No credit card required')).toBeInTheDocument();
    expect(
      screen.getByText('Trusted by engineering teams shipping quality software'),
    ).toBeInTheDocument();
  });

  it('renders social proof avatar indicators', () => {
    renderHero();
    const avatars = document.querySelectorAll('.rounded-full.border-2');
    expect(avatars.length).toBe(4);
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('renders without data-motion attributes', () => {
      renderHero();
      const motionElements = document.querySelectorAll('[data-motion]');
      expect(motionElements.length).toBe(0);
    });

    it('still renders all content', () => {
      renderHero();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByText('AI-Powered QA')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start free trial/i })).toBeInTheDocument();
    });
  });
});

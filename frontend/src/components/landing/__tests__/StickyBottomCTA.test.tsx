import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    motion: {
      ...actual.motion,
      div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
        (props: Record<string, unknown>, ref) => {
          const filtered: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(props)) {
            if (
              !['initial', 'animate', 'exit', 'transition', 'layout', 'whileInView', 'viewport', 'variants'].includes(k)
            ) {
              filtered[k] = v;
            }
          }
          return <div ref={ref} {...filtered} />;
        },
      ),
    },
  };
});

import { StickyBottomCTA } from '../StickyBottomCTA';

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

const STORAGE_KEY = 'landing.stickyCTA.dismissed';

let intersectionCallback: IntersectionObserverCallback;

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

function createHeroSentinel() {
  const el = document.createElement('section');
  el.id = 'hero';
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  mockMatchMedia(false);
  localStorage.clear();

  globalThis.IntersectionObserver = vi.fn().mockImplementation((cb: IntersectionObserverCallback) => {
    intersectionCallback = cb;
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: () => [],
    };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  const hero = document.getElementById('hero');
  if (hero) hero.remove();
});

function renderSticky() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <StickyBottomCTA />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

function simulateHeroScrolledPast() {
  const hero = document.getElementById('hero')!;
  act(() => {
    intersectionCallback(
      [
        {
          isIntersecting: false,
          intersectionRatio: 0,
          target: hero,
          boundingClientRect: hero.getBoundingClientRect(),
          intersectionRect: hero.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now(),
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  });
}

describe('StickyBottomCTA', () => {
  it('is hidden initially before hero scrolls out of view', () => {
    createHeroSentinel();
    renderSticky();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('becomes visible when hero scrolls out of view', async () => {
    createHeroSentinel();
    renderSticky();
    simulateHeroScrolledPast();
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
    expect(screen.getByText('Find bugs before your users do.')).toBeInTheDocument();
  });

  it('has CTA button and dismiss button', async () => {
    createHeroSentinel();
    renderSticky();
    simulateHeroScrolledPast();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start free/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('dismiss sets localStorage and hides the bar', async () => {
    createHeroSentinel();
    renderSticky();
    simulateHeroScrolledPast();
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    await waitFor(() => {
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('stays hidden when dismissed within 30 days', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(STORAGE_KEY, twoDaysAgo);

    createHeroSentinel();
    renderSticky();
    simulateHeroScrolledPast();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('re-appears after 31 days since dismiss', async () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(STORAGE_KEY, thirtyOneDaysAgo);

    createHeroSentinel();
    renderSticky();
    simulateHeroScrolledPast();
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('has correct aria-label', async () => {
    createHeroSentinel();
    renderSticky();
    simulateHeroScrolledPast();
    await waitFor(() => {
      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Quick action bar');
    });
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('still shows content when hero scrolls past', async () => {
      createHeroSentinel();
      renderSticky();
      simulateHeroScrolledPast();
      await waitFor(() => {
        expect(screen.getByText('Find bugs before your users do.')).toBeInTheDocument();
      });
    });
  });
});

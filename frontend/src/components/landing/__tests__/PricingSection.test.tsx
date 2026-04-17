import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { PricingSection } from '../PricingSection';

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

  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ plans: [], trialDays: 14 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPricing() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <PricingSection />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('PricingSection', () => {
  it('renders 3 tier cards', () => {
    renderPricing();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Pro (BYO Keys)')).toBeInTheDocument();
    expect(screen.getByText('Pro (Managed)')).toBeInTheDocument();
  });

  it('renders heading and subheading', () => {
    renderPricing();
    expect(screen.getByText('Simple, transparent pricing')).toBeInTheDocument();
    expect(screen.getByText(/Start free, upgrade/)).toBeInTheDocument();
  });

  it('shows live prices when API succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          plans: [
            { slug: 'pro_byo', monthlyCents: 3900 },
            { slug: 'pro_managed', monthlyCents: 5900 },
          ],
          trialDays: 14,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    renderPricing();
    await vi.waitFor(() => {
      expect(screen.getByText('$39')).toBeInTheDocument();
    });
  });

  it('falls back to defaults when API fails without error UI', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    renderPricing();
    expect(screen.getByText('$29')).toBeInTheDocument();
    expect(screen.getByText('$49')).toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument();
  });

  it('monthly/annual toggle: switching updates displayed price', async () => {
    const user = userEvent.setup();
    renderPricing();
    expect(screen.getByText('$29')).toBeInTheDocument();

    const annualTab = screen.getByRole('tab', { name: /annual/i });
    await user.click(annualTab);

    await vi.waitFor(() => {
      expect(screen.getByText('$23.2')).toBeInTheDocument();
    });
  });

  it('annual toggle shows save badge', () => {
    renderPricing();
    expect(screen.getByText(/Save 20%/)).toBeInTheDocument();
  });

  it('popular badge is present on Pro BYO tier', () => {
    renderPricing();
    expect(screen.getByText('Most popular')).toBeInTheDocument();
  });

  it('renders correct CTA buttons', () => {
    renderPricing();
    expect(screen.getByRole('link', { name: 'Start free' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/signup?plan=pro_byo',
    );
    expect(screen.getByRole('link', { name: 'Contact sales' })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('shows trial days on monthly billing', () => {
    renderPricing();
    const trialTexts = screen.getAllByText(/14-day free trial/);
    expect(trialTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows free forever for free plan', () => {
    renderPricing();
    expect(screen.getByText('Free forever')).toBeInTheDocument();
  });

  it('renders feature lists for each plan', () => {
    renderPricing();
    expect(screen.getByText('50 test runs per month')).toBeInTheDocument();
    expect(screen.getByText('Bring your own API keys')).toBeInTheDocument();
    expect(screen.getByText('Managed AI infrastructure')).toBeInTheDocument();
  });

  it('no forbidden Uncodixify classes on cards', () => {
    renderPricing();
    const section = document.getElementById('pricing');
    const cards = section?.querySelectorAll('.bg-card') ?? [];
    for (const card of cards) {
      const classes = card.className;
      expect(classes).not.toMatch(/translate-y/);
      expect(classes).not.toMatch(/scale-/);
      expect(classes).not.toMatch(/shadow-md/);
      expect(classes).not.toMatch(/shadow-lg/);
      expect(classes).not.toMatch(/rounded-2xl/);
      expect(classes).not.toMatch(/rounded-3xl/);
    }
  });

  it('Intl.NumberFormat renders expected string for en', () => {
    renderPricing();
    expect(screen.getByText('$29')).toBeInTheDocument();
  });

  it.each([
    ['fr', /29/],
    ['de', /29/],
    ['es', /29/],
  ])('renders price for %s locale', async (lang, pattern) => {
    await testI18n.changeLanguage(lang);
    renderPricing();
    expect(screen.getByText(pattern)).toBeInTheDocument();
    await testI18n.changeLanguage('en');
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('renders all 3 plans without animations', () => {
      renderPricing();
      expect(screen.getByText('Free')).toBeInTheDocument();
      expect(screen.getByText('Pro (BYO Keys)')).toBeInTheDocument();
      expect(screen.getByText('Pro (Managed)')).toBeInTheDocument();
    });
  });
});

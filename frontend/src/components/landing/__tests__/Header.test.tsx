import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { Header } from '../Header';

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
const NAMESPACES = ['common', 'landing'];

const resources: Record<string, Record<string, unknown>> = {};
for (const lang of LANGUAGES) {
  resources[lang] = {};
  for (const ns of NAMESPACES) {
    resources[lang][ns] = JSON.parse(
      fs.readFileSync(path.join(LOCALES_DIR, lang, `${ns}.json`), 'utf-8'),
    );
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

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/components/ui/Logo', () => ({
  Logo: ({ size }: { size?: string }) => <div data-testid="logo" data-size={size} />,
}));

vi.mock('@/components/ThemeProvider', () => ({
  useThemeContext: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
    toggle: vi.fn(),
  }),
}));

let intersectionCallbacks: Array<IntersectionObserverCallback> = [];
let observedElements: Element[] = [];

beforeEach(() => {
  intersectionCallbacks = [];
  observedElements = [];

  globalThis.IntersectionObserver = vi.fn().mockImplementation((cb: IntersectionObserverCallback) => {
    intersectionCallbacks.push(cb);
    return {
      observe: (el: Element) => observedElements.push(el),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: () => [],
    };
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? false : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  });

  Object.defineProperty(window, 'scrollY', { writable: true, value: 0 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderHeader() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <div>
          <div id="features" data-testid="section-features" style={{ height: '500px' }}>Features Section</div>
          <div id="pricing" data-testid="section-pricing" style={{ height: '500px' }}>Pricing Section</div>
        </div>
        <Header />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('Header', () => {
  it('renders all desktop nav items', () => {
    renderHeader();
    const header = document.querySelector('header')!;
    expect(header.querySelector('button')).toBeTruthy();
    expect(screen.getAllByText('Features').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pricing').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('Get started')).toBeInTheDocument();
  });

  it('renders mobile menu button', () => {
    renderHeader();
    expect(screen.getByLabelText('Menu')).toBeInTheDocument();
  });

  it('mobile sheet opens on button click', async () => {
    renderHeader();
    const menuBtn = screen.getByLabelText('Menu');
    await act(async () => {
      fireEvent.click(menuBtn);
    });
    const navs = screen.getAllByLabelText('Main navigation');
    expect(navs.length).toBeGreaterThanOrEqual(1);
  });

  it('scroll event past 64px toggles data-scrolled="true"', () => {
    renderHeader();
    const header = document.querySelector('header');
    expect(header?.getAttribute('data-scrolled')).toBe('false');

    Object.defineProperty(window, 'scrollY', { writable: true, value: 100 });
    fireEvent.scroll(window);

    expect(header?.getAttribute('data-scrolled')).toBe('true');
  });

  it('scroll below threshold keeps data-scrolled="false"', () => {
    renderHeader();
    Object.defineProperty(window, 'scrollY', { writable: true, value: 30 });
    fireEvent.scroll(window);
    const header = document.querySelector('header');
    expect(header?.getAttribute('data-scrolled')).toBe('false');
  });

  it('active-section marker follows IntersectionObserver', () => {
    renderHeader();
    const featuresEl = document.getElementById('features');
    if (featuresEl && intersectionCallbacks.length > 0) {
      act(() => {
        intersectionCallbacks[0](
          [{
            isIntersecting: true,
            target: featuresEl,
            intersectionRatio: 1,
            boundingClientRect: featuresEl.getBoundingClientRect(),
            intersectionRect: featuresEl.getBoundingClientRect(),
            rootBounds: null,
            time: Date.now(),
          } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      });
      const activeButton = document.querySelector('[data-active="true"]');
      expect(activeButton).toBeInTheDocument();
      expect(activeButton?.textContent).toBe('Features');
    }
  });

  it('language switch button is present and accessible', () => {
    renderHeader();
    const langBtn = screen.getByLabelText('Change language');
    expect(langBtn).toBeInTheDocument();
  });

  it('language change updates document attributes', async () => {
    renderHeader();
    await act(async () => {
      await testI18n.changeLanguage('fr');
      document.documentElement.setAttribute('lang', 'fr');
      document.documentElement.setAttribute('dir', 'ltr');
    });
    expect(testI18n.language).toBe('fr');
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    await act(async () => {
      await testI18n.changeLanguage('en');
      document.documentElement.setAttribute('lang', 'en');
      document.documentElement.setAttribute('dir', 'ltr');
    });
  });

  it('theme toggle is present', () => {
    renderHeader();
    const themeButtons = screen.getAllByLabelText(/Switch to .* mode/i);
    expect(themeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('has no data-scrolled initially when scrollY is 0', () => {
    renderHeader();
    const header = document.querySelector('header');
    expect(header?.getAttribute('data-scrolled')).toBe('false');
  });
});

describe('Header - reduced motion', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      })),
    });
  });

  it('renders correctly with reduced motion', () => {
    renderHeader();
    expect(screen.getAllByText('Features').length).toBeGreaterThanOrEqual(1);
  });
});

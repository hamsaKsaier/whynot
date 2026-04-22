import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { Footer } from '../Footer';

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

vi.mock('@/components/ui/Logo', () => ({
  Logo: ({ size }: { size?: string }) => <div data-testid="logo" data-size={size} />,
}));

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  });

  globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
    takeRecords: () => [],
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderFooter() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('Footer', () => {
  it('renders 4 column headings', () => {
    renderFooter();
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Legal')).toBeInTheDocument();
  });

  it('renders all column links', () => {
    renderFooter();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Changelog')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Blog')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('API')).toBeInTheDocument();
  });

  it('renders legal links in footer bottom', () => {
    renderFooter();
    const footerEl = document.querySelector('footer');
    expect(footerEl).toBeInTheDocument();

    const termsLinks = screen.getAllByText('Terms of Service');
    expect(termsLinks.length).toBeGreaterThanOrEqual(1);

    const privacyLinks = screen.getAllByText('Privacy Policy');
    expect(privacyLinks.length).toBeGreaterThanOrEqual(1);

    const securityLinks = screen.getAllByText('Security');
    expect(securityLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('aria-current on active locale in language switcher', () => {
    renderFooter();
    const activeLocaleBtn = document.querySelector('[aria-current="true"]');
    expect(activeLocaleBtn).toBeInTheDocument();
    expect(activeLocaleBtn?.textContent).toContain('EN');
  });

  it('rel="noopener noreferrer" on every external link', () => {
    renderFooter();
    const externalLinks = document.querySelectorAll('a[target="_blank"]');
    expect(externalLinks.length).toBeGreaterThan(0);
    externalLinks.forEach((link) => {
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
    });
  });

  it('social icons have aria-label', () => {
    renderFooter();
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
    expect(screen.getByLabelText('X (Twitter)')).toBeInTheDocument();
  });

  it('renders copyright with current year', () => {
    renderFooter();
    const year = new Date().getFullYear().toString();
    const copyright = document.querySelector('small');
    expect(copyright).toBeInTheDocument();
    expect(copyright?.textContent).toContain(year);
    expect(copyright?.textContent).toContain('WhyNot');
  });

  it('language switcher has radiogroup role', () => {
    renderFooter();
    const radiogroup = document.querySelector('[role="radiogroup"]');
    expect(radiogroup).toBeInTheDocument();
  });

  it('has contentinfo role', () => {
    renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
  });
});

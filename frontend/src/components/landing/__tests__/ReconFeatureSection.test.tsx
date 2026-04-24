import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { ReconFeatureSection } from '../ReconFeatureSection';

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
const NAMESPACES = ['common', 'landing'];

const BANNED_VOCABULARY = [
  'Shannon',
  'KeygraphHQ',
  'nmap',
  'subfinder',
  'whatweb',
  'schemathesis',
  'Playwright',
  'Anthropic',
  'Claude',
];

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
const mockNavigate = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
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
  mockIsAuthenticated = false;
  mockNavigate.mockReset();
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

function renderSection(lng: (typeof LANGUAGES)[number] = 'en') {
  testI18n.changeLanguage(lng);
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <ReconFeatureSection />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('ReconFeatureSection', () => {
  it('renders heading, subtitle, and eyebrow', () => {
    renderSection();
    expect(screen.getByText('Pentest every release. Not once a year.')).toBeInTheDocument();
    expect(screen.getByText(/Recon runs an autonomous, white-box security test/)).toBeInTheDocument();
    expect(screen.getByText('Now in beta')).toBeInTheDocument();
  });

  it('renders all 3 benefit cards', () => {
    renderSection();
    expect(screen.getByText('Proof, not theory')).toBeInTheDocument();
    expect(screen.getByText('Source-aware')).toBeInTheDocument();
    expect(screen.getByText('On-demand')).toBeInTheDocument();
    expect(
      screen.getByText('Every finding ships with a working exploit you can re-run.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Recon reads your codebase to focus the test on what matters.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Run a full pentest in about an hour. Repeat as often as you ship.'),
    ).toBeInTheDocument();
  });

  it('uses proper landmark with aria-labelledby', () => {
    const { container } = renderSection();
    const section = container.querySelector('section#recon');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('aria-labelledby')).toBe('recon-feature-heading');
    const heading = container.querySelector('#recon-feature-heading');
    expect(heading).not.toBeNull();
    expect(heading?.tagName).toBe('H2');
  });

  it('primary CTA navigates to /signup?ref=recon for unauthenticated users', () => {
    mockIsAuthenticated = false;
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /Try Recon/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/signup?ref=recon');
  });

  it('primary CTA navigates to /recon for authenticated users', () => {
    mockIsAuthenticated = true;
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /Try Recon/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/recon');
  });

  it('sample-report modal opens and closes', async () => {
    renderSection();
    fireEvent.click(screen.getByTestId('recon-sample-report-trigger'));

    await waitFor(() => {
      expect(
        screen.getByText('Sample finding: reflected input escape bypass'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));

    await waitFor(() => {
      expect(
        screen.queryByText('Sample finding: reflected input escape bypass'),
      ).not.toBeInTheDocument();
    });
  });

  it('no card uses forbidden hover effects', () => {
    renderSection();
    const cards = document.querySelectorAll('[data-motion="reveal"]');
    for (const card of cards) {
      const classes = card.className;
      expect(classes).not.toMatch(/translate-y/);
      expect(classes).not.toMatch(/\bscale-/);
      expect(classes).not.toMatch(/shadow-md/);
      expect(classes).not.toMatch(/shadow-lg/);
    }
  });

  it('contains no banned vocabulary in rendered output', () => {
    const { container } = renderSection();
    const html = container.innerHTML;
    for (const term of BANNED_VOCABULARY) {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      expect(html, `banned term "${term}" should not appear in rendered output`).not.toMatch(regex);
    }
  });

  it('snapshot: en', () => {
    const { container } = renderSection('en');
    expect(container.firstChild).toMatchSnapshot();
  });

  it('snapshot: ar', () => {
    const { container } = renderSection('ar');
    expect(container.firstChild).toMatchSnapshot();
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('still renders all content without motion wrappers driving layout', () => {
      renderSection();
      expect(screen.getByText('Proof, not theory')).toBeInTheDocument();
      expect(screen.getByText('Source-aware')).toBeInTheDocument();
      expect(screen.getByText('On-demand')).toBeInTheDocument();
    });
  });
});

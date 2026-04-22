import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { PaygPricingSection } from '../PaygPricingSection';

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
    new Response(JSON.stringify({ paygRates: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPayg() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <PaygPricingSection />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('PaygPricingSection', () => {
  it('renders heading and subheading', () => {
    renderPayg();
    expect(screen.getByText('Pay-as-you-go pricing')).toBeInTheDocument();
    expect(screen.getByText(/Only pay for what you use/)).toBeInTheDocument();
  });

  it('renders all 7 event rows in the credit breakdown table', () => {
    renderPayg();
    const table = document.querySelector('table');
    expect(table).not.toBeNull();
    const rows = table!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(7);

    const events = [
      'Test generation',
      'Test execution',
      'QA loop iteration',
      'Auto-fix attempt',
      'Visual regression',
      'QA monitor session',
      'CI scan',
    ];
    for (const event of events) {
      const cells = table!.querySelectorAll('td');
      const found = Array.from(cells).some((cell) => cell.textContent?.includes(event));
      expect(found).toBe(true);
    }
  });

  it('renders credit pack cards', () => {
    renderPayg();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('Scale')).toBeInTheDocument();
  });

  it('shows best value badge on the cheapest per-credit pack', () => {
    renderPayg();
    expect(screen.getByText('Best value')).toBeInTheDocument();
  });

  it('calculator inputs update total', async () => {
    const user = userEvent.setup();
    renderPayg();

    const calculator = document.querySelector('[data-testid="credit-calculator"]')!;
    const inputs = calculator.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(7);

    const firstInput = inputs[0] as HTMLInputElement;
    await user.clear(firstInput);
    await user.type(firstInput, '10');

    const totalEl = screen.getByTestId('total-credits');
    await vi.waitFor(() => {
      expect(totalEl.textContent).not.toBe('0');
    });
  });

  it('recommended pack shows when total > 0', async () => {
    const user = userEvent.setup();
    renderPayg();

    const inputs = screen.getAllByRole('spinbutton');
    await user.clear(inputs[0]);
    await user.type(inputs[0], '20');

    await vi.waitFor(() => {
      expect(screen.getByTestId('recommended-pack')).toBeInTheDocument();
    });
  });

  it('worked example expand/collapse toggles aria-expanded', async () => {
    const user = userEvent.setup();
    renderPayg();

    const toggle = screen.getByRole('button', { name: /worked example/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('worked example shows content when expanded', async () => {
    const user = userEvent.setup();
    renderPayg();

    const toggle = screen.getByRole('button', { name: /worked example/i });
    await user.click(toggle);

    await vi.waitFor(() => {
      expect(screen.getByText(/SaaS team with 20 engineers/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Total: 5,500 credits/)).toBeInTheDocument();
  });

  it('all calculator inputs have labels', () => {
    renderPayg();
    const inputs = screen.getAllByRole('spinbutton');
    for (const input of inputs) {
      expect(input).toHaveAttribute('aria-label');
    }
  });

  it('no forbidden Uncodixify classes on pack cards', () => {
    renderPayg();
    const cards = document.querySelectorAll('[data-motion="stagger"] .bg-card');
    for (const card of cards) {
      const classes = card.className;
      expect(classes).not.toMatch(/translate-y/);
      expect(classes).not.toMatch(/scale-/);
      expect(classes).not.toMatch(/shadow-md/);
      expect(classes).not.toMatch(/shadow-lg/);
    }
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('renders all content without animations', () => {
      renderPayg();
      const table = document.querySelector('table');
      expect(table).not.toBeNull();
      const rows = table!.querySelectorAll('tbody tr');
      expect(rows.length).toBe(7);
      expect(screen.getAllByText('Starter').length).toBeGreaterThanOrEqual(1);
    });

    it('calculator shows final value directly', async () => {
      const user = userEvent.setup();
      renderPayg();

      const inputs = screen.getAllByRole('spinbutton');
      await user.clear(inputs[0]);
      await user.type(inputs[0], '10');

      const totalEl = screen.getByTestId('total-credits');
      expect(totalEl.textContent).toContain('500');
    });
  });
});

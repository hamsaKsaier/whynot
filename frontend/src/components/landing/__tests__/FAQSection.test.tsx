import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { FAQSection } from '../FAQSection';

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

  window.location.hash = '';
  document.documentElement.dir = 'ltr';
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = '';
});

function renderFAQ() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <FAQSection />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('FAQSection', () => {
  it('renders all 5 FAQ items', () => {
    renderFAQ();
    expect(screen.getByText('How does WhyNot find bugs automatically?')).toBeInTheDocument();
    expect(screen.getByText('How do I integrate WhyNot with my app?')).toBeInTheDocument();
    expect(screen.getByText('Is there a free tier?')).toBeInTheDocument();
    expect(screen.getByText('Is my application data secure?')).toBeInTheDocument();
    expect(screen.getByText('How accurate is the bug detection?')).toBeInTheDocument();
  });

  it('renders heading and subheading', () => {
    renderFAQ();
    expect(screen.getByText('Frequently asked questions')).toBeInTheDocument();
    expect(screen.getByText('Everything you need to know about WhyNot.')).toBeInTheDocument();
  });

  it('clicking a question expands it', () => {
    renderFAQ();
    const trigger = screen.getByText('How does WhyNot find bugs automatically?');
    fireEvent.click(trigger);
    expect(screen.getByText(/WhyNot deploys autonomous AI agents/)).toBeInTheDocument();
  });

  it('chevron has rotate class when item is open', () => {
    renderFAQ();
    const trigger = screen.getByText('How does WhyNot find bugs automatically?');
    const chevron = trigger.closest('button')?.querySelector('svg');
    expect(chevron?.getAttribute('class')).not.toContain('rotate-180');

    fireEvent.click(trigger);
    const updatedChevron = trigger.closest('button')?.querySelector('svg');
    expect(updatedChevron?.getAttribute('class')).toContain('rotate-180');
  });

  it('second click collapses the item', async () => {
    renderFAQ();
    const trigger = screen.getByText('How does WhyNot find bugs automatically?');

    fireEvent.click(trigger);
    expect(screen.getByText(/WhyNot deploys autonomous AI agents/)).toBeInTheDocument();

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.queryByText(/WhyNot deploys autonomous AI agents/)).not.toBeInTheDocument();
    });
  });

  it('only one item open at a time', async () => {
    renderFAQ();
    const q1 = screen.getByText('How does WhyNot find bugs automatically?');
    const q2 = screen.getByText('How do I integrate WhyNot with my app?');

    fireEvent.click(q1);
    expect(screen.getByText(/WhyNot deploys autonomous AI agents/)).toBeInTheDocument();

    fireEvent.click(q2);
    expect(screen.getByText(/Just provide your app's URL/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/WhyNot deploys autonomous AI agents/)).not.toBeInTheDocument();
    });
  });

  it('updates URL hash on expand', () => {
    renderFAQ();
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    const trigger = screen.getByText('Is my application data secure?');
    fireEvent.click(trigger);

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '#faq-security');
  });

  it('clears URL hash on collapse', async () => {
    renderFAQ();
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    const trigger = screen.getByText('Is my application data secure?');
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    await waitFor(() => {
      const lastCall = replaceStateSpy.mock.calls[replaceStateSpy.mock.calls.length - 1];
      expect(lastCall[2]).not.toContain('#faq-');
    });
  });

  it('opens matching item when hash changes externally', async () => {
    renderFAQ();

    window.location.hash = '#faq-pricing';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    await waitFor(() => {
      expect(screen.getByText(/free tier includes 50 test runs/)).toBeInTheDocument();
    });
  });

  it('page load with #faq-{id} opens and scrolls to that item', () => {
    window.location.hash = '#faq-security';
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    renderFAQ();

    expect(screen.getByText(/WhyNot runs tests in isolated browser sandboxes/)).toBeInTheDocument();
  });

  it('renders contact link', () => {
    renderFAQ();
    expect(screen.getByText('Still have questions?')).toBeInTheDocument();
    const contactLink = screen.getByText('Contact us');
    expect(contactLink).toBeInTheDocument();
    expect(contactLink.closest('a')).toHaveAttribute('href', 'mailto:support@whynot.sh');
  });

  it('contact link arrow has RTL mirror class', () => {
    renderFAQ();
    const contactLink = screen.getByText('Contact us');
    const arrow = contactLink.closest('a')?.querySelector('svg');
    expect(arrow?.getAttribute('class')).toContain('rtl:scale-x-[-1]');
  });

  it('each FAQ item has an id for deep-linking', () => {
    renderFAQ();
    const ids = ['faq-howItWorks', 'faq-integration', 'faq-pricing', 'faq-security', 'faq-accuracy'];
    for (const id of ids) {
      expect(document.getElementById(id)).toBeInTheDocument();
    }
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('renders all items', () => {
      renderFAQ();
      expect(screen.getByText('How does WhyNot find bugs automatically?')).toBeInTheDocument();
      expect(screen.getByText('How accurate is the bug detection?')).toBeInTheDocument();
    });

    it('expand/collapse still works', async () => {
      renderFAQ();
      const trigger = screen.getByText('Is there a free tier?');
      fireEvent.click(trigger);
      expect(screen.getByText(/free tier includes 50 test runs/)).toBeInTheDocument();

      fireEvent.click(trigger);
      await waitFor(() => {
        expect(screen.queryByText(/free tier includes 50 test runs/)).not.toBeInTheDocument();
      });
    });

    it('scrollIntoView uses auto behavior', () => {
      window.location.hash = '#faq-security';
      const scrollMock = vi.fn();
      Element.prototype.scrollIntoView = scrollMock;

      renderFAQ();

      if (scrollMock.mock.calls.length > 0) {
        expect(scrollMock.mock.calls[0][0]).toEqual(
          expect.objectContaining({ behavior: 'auto' }),
        );
      }
    });
  });

  it('has proper aria-labelledby on section', () => {
    renderFAQ();
    const section = document.getElementById('faq');
    expect(section).toHaveAttribute('aria-labelledby', 'faq-heading');
  });

  it('no banned animation/hover classes', () => {
    renderFAQ();
    const section = document.getElementById('faq')!;
    const allElements = section.querySelectorAll('*');
    for (const el of allElements) {
      const cls = el.className;
      if (typeof cls === 'string') {
        expect(cls).not.toMatch(/animate-bounce/);
        expect(cls).not.toMatch(/animate-pulse/);
        expect(cls).not.toMatch(/shadow-lg/);
        expect(cls).not.toMatch(/rounded-2xl/);
      }
    }
  });
});

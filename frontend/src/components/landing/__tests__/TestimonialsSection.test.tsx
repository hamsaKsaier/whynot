import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { TestimonialsSection } from '../TestimonialsSection';

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

let resizeCallback: ResizeObserverCallback | null = null;

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

  globalThis.ResizeObserver = vi.fn().mockImplementation((cb: ResizeObserverCallback) => {
    resizeCallback = cb;
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
  });

  document.documentElement.dir = 'ltr';
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resizeCallback = null;
});

function renderTestimonials() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <TestimonialsSection />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('TestimonialsSection', () => {
  it('renders all three testimonial cards', () => {
    renderTestimonials();
    expect(screen.getAllByText('Sarah Chen').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Marcus Johnson').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Elena Rodriguez').length).toBeGreaterThanOrEqual(1);
  });

  it('renders heading and subheading', () => {
    renderTestimonials();
    expect(screen.getByText('Loved by engineering teams')).toBeInTheDocument();
    expect(screen.getByText(/See how teams use WhyNot/)).toBeInTheDocument();
  });

  it('renders quotes in blockquote elements', () => {
    renderTestimonials();
    const blockquotes = document.querySelectorAll('blockquote');
    expect(blockquotes.length).toBeGreaterThanOrEqual(3);
  });

  it('renders cite elements for attribution', () => {
    renderTestimonials();
    const cites = document.querySelectorAll('cite');
    expect(cites.length).toBeGreaterThanOrEqual(3);
  });

  it('renders company names', () => {
    renderTestimonials();
    expect(screen.getAllByText('ShopFlow').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('LaunchPad AI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Meridian Health').length).toBeGreaterThanOrEqual(1);
  });

  it('renders author initials', () => {
    renderTestimonials();
    expect(screen.getAllByText('SC').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('MJ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ER').length).toBeGreaterThanOrEqual(1);
  });

  it('has carousel region with correct ARIA attributes', () => {
    renderTestimonials();
    const carousels = document.querySelectorAll('[aria-roledescription="carousel"]');
    expect(carousels.length).toBeGreaterThanOrEqual(1);
  });

  it('has slide elements with aria-roledescription', () => {
    renderTestimonials();
    const slides = document.querySelectorAll('[aria-roledescription="slide"]');
    expect(slides.length).toBeGreaterThanOrEqual(3);
  });

  it('renders dot indicators with tablist role', () => {
    renderTestimonials();
    const tablist = document.querySelector('[role="tablist"]');
    expect(tablist).toBeInTheDocument();
    const tabs = document.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
  });

  it('first dot is selected by default', () => {
    renderTestimonials();
    const tabs = document.querySelectorAll('[role="tab"]');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking dot indicator updates active slide', () => {
    renderTestimonials();
    const tabs = document.querySelectorAll('[role="tab"]');
    fireEvent.click(tabs[2]);
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('has desktop grid layout', () => {
    renderTestimonials();
    const grid = document.querySelector('.md\\:grid-cols-3');
    expect(grid).toBeInTheDocument();
  });

  describe('autoplay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('advances every 6 seconds', () => {
      renderTestimonials();
      const tabs = document.querySelectorAll('[role="tab"]');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    });

    it('wraps around after last slide', () => {
      renderTestimonials();
      const tabs = document.querySelectorAll('[role="tab"]');

      act(() => {
        vi.advanceTimersByTime(18000);
      });
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('pauses on mouseenter and resumes on mouseleave', () => {
      renderTestimonials();
      const carousel = document.querySelector('[aria-roledescription="carousel"]')!;
      const tabs = document.querySelectorAll('[role="tab"]');

      fireEvent.mouseEnter(carousel);
      act(() => {
        vi.advanceTimersByTime(12000);
      });
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      fireEvent.mouseLeave(carousel);
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('pauses on focus and resumes on blur', () => {
      renderTestimonials();
      const carousel = document.querySelector('[aria-roledescription="carousel"]')!;
      const tabs = document.querySelectorAll('[role="tab"]');

      fireEvent.focus(carousel);
      act(() => {
        vi.advanceTimersByTime(12000);
      });
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      fireEvent.blur(carousel);
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('pauses when document is hidden', () => {
      renderTestimonials();
      const tabs = document.querySelectorAll('[role="tab"]');

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      act(() => {
        vi.advanceTimersByTime(12000);
      });
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('keyboard navigation', () => {
    it('ArrowRight advances to next slide in LTR', () => {
      document.documentElement.dir = 'ltr';
      renderTestimonials();
      const carousel = document.querySelector('[aria-roledescription="carousel"]')!;
      const tabs = document.querySelectorAll('[role="tab"]');

      fireEvent.keyDown(carousel, { key: 'ArrowRight' });
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('ArrowLeft goes to previous slide in LTR', () => {
      document.documentElement.dir = 'ltr';
      renderTestimonials();
      const carousel = document.querySelector('[aria-roledescription="carousel"]')!;
      const tabs = document.querySelectorAll('[role="tab"]');

      fireEvent.keyDown(carousel, { key: 'ArrowRight' });
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('ArrowLeft advances to next slide in RTL', () => {
      document.documentElement.dir = 'rtl';
      renderTestimonials();
      const carousel = document.querySelector('[aria-roledescription="carousel"]')!;
      const tabs = document.querySelectorAll('[role="tab"]');

      fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('ArrowRight goes to previous slide in RTL', () => {
      document.documentElement.dir = 'rtl';
      renderTestimonials();
      const carousel = document.querySelector('[aria-roledescription="carousel"]')!;
      const tabs = document.querySelectorAll('[role="tab"]');

      fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(carousel, { key: 'ArrowRight' });
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not go below index 0', () => {
      renderTestimonials();
      const carousel = document.querySelector('[aria-roledescription="carousel"]')!;
      const tabs = document.querySelectorAll('[role="tab"]');

      fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not go above max index', () => {
      renderTestimonials();
      const carousel = document.querySelector('[aria-roledescription="carousel"]')!;
      const tabs = document.querySelectorAll('[role="tab"]');

      fireEvent.keyDown(carousel, { key: 'ArrowRight' });
      fireEvent.keyDown(carousel, { key: 'ArrowRight' });
      fireEvent.keyDown(carousel, { key: 'ArrowRight' });
      expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      mockMatchMedia(true);
    });

    it('renders all cards', () => {
      renderTestimonials();
      expect(screen.getAllByText('Sarah Chen').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Marcus Johnson').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Elena Rodriguez').length).toBeGreaterThanOrEqual(1);
    });

    it('uses snap-scroll fallback instead of drag carousel', () => {
      renderTestimonials();
      const snapContainer = document.querySelector('.snap-x');
      expect(snapContainer).toBeInTheDocument();
    });

    it('autoplay is disabled', () => {
      vi.useFakeTimers();
      renderTestimonials();
      const tabs = document.querySelectorAll('[role="tab"]');

      act(() => {
        vi.advanceTimersByTime(18000);
      });
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      vi.useRealTimers();
    });

    it('keyboard navigation still works', () => {
      renderTestimonials();
      const carousel = document.querySelector('[aria-roledescription="carousel"]')!;
      const tabs = document.querySelectorAll('[role="tab"]');

      fireEvent.keyDown(carousel, { key: 'ArrowRight' });
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('dot indicators still work', () => {
      renderTestimonials();
      const tabs = document.querySelectorAll('[role="tab"]');

      fireEvent.click(tabs[1]);
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('no banned hover/animation classes on cards', () => {
    renderTestimonials();
    const cards = document.querySelectorAll('.bg-card');
    for (const card of cards) {
      const cls = card.className;
      expect(cls).not.toMatch(/translate-y/);
      expect(cls).not.toMatch(/shadow-lg/);
      expect(cls).not.toMatch(/shadow-md/);
      expect(cls).not.toMatch(/animate-pulse/);
      expect(cls).not.toMatch(/animate-bounce/);
      expect(cls).not.toMatch(/rounded-2xl/);
    }
  });
});

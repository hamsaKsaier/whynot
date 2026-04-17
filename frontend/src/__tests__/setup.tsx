import '@testing-library/jest-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'node:fs';
import path from 'node:path';

const LOCALES_DIR = path.resolve(__dirname, '../../public/locales');
const LANGS = ['en', 'ar', 'fr', 'de', 'es'] as const;
const NAMESPACES = ['common', 'auth', 'dashboard', 'runner', 'results', 'settings', 'billing', 'landing'] as const;

const resources: Record<string, Record<string, any>> = {};
for (const lng of LANGS) {
  resources[lng] = {};
  for (const ns of NAMESPACES) {
    const file = path.join(LOCALES_DIR, lng, `${ns}.json`);
    if (fs.existsSync(file)) {
      try {
        resources[lng][ns] = JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch {
        resources[lng][ns] = {};
      }
    } else {
      resources[lng][ns] = {};
    }
  }
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources,
    ns: NAMESPACES as unknown as string[],
    defaultNS: 'common',
    keySeparator: false,
    nsSeparator: ':',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (typeof window !== 'undefined' && typeof window.scrollTo !== 'function') {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    private callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
      this.callback = callback;
    }

    observe(target: Element) {
      const entry = {
        isIntersecting: true,
        intersectionRatio: 1,
        target,
        boundingClientRect: target.getBoundingClientRect(),
        intersectionRect: target.getBoundingClientRect(),
        rootBounds: null,
        time: Date.now(),
      } as IntersectionObserverEntry;
      this.callback([entry], this);
    }

    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };
}

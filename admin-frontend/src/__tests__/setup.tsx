import '@testing-library/jest-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom doesn't implement matchMedia; default to desktop breakpoints matching.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: /min-width:\s*(\d+)px/.test(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom doesn't implement scrollTo
if (!window.scrollTo) {
  Object.defineProperty(window, 'scrollTo', { writable: true, value: () => {} });
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const localesDir = path.resolve(__dirname, '../../public/locales/en');
const namespaces = ['admin', 'auth', 'common', 'settings', 'superadmin'];

const resources: Record<string, string | object> = {};
for (const ns of namespaces) {
  resources[ns] = JSON.parse(fs.readFileSync(path.join(localesDir, `${ns}.json`), 'utf-8'));
}

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: namespaces,
  defaultNS: 'common',
  resources: { en: resources },
  interpolation: { escapeValue: false },
});

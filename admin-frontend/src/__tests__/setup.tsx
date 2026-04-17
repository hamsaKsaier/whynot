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

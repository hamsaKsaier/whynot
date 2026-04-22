import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';

export const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
export type SupportedLang = (typeof LANGUAGES)[number];

const LOCALES_DIR = path.resolve(__dirname, '../../../public/locales');
const NAMESPACES = ['common', 'auth', 'dashboard', 'runner', 'results', 'settings', 'billing', 'landing'];

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

export interface RenderAtLocaleOptions {
  initialEntries?: string[];
  routePattern?: string;
}

export async function renderAtLocale(
  ui: React.ReactElement,
  lang: SupportedLang,
  options?: RenderAtLocaleOptions,
): Promise<RenderResult> {
  await testI18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  const entry = options?.initialEntries?.[0] ?? '/';
  const pattern = options?.routePattern ?? entry;

  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={pattern} element={ui} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

export async function resetLocale(): Promise<void> {
  await testI18n.changeLanguage('en');
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
}

export { testI18n };

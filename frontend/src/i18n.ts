import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

export const LANGUAGE_META: Record<
  SupportedLanguage,
  { nativeName: string; flag: string; dir: 'ltr' | 'rtl' }
> = {
  en: { nativeName: 'English', flag: '🇺🇸', dir: 'ltr' },
  ar: { nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  fr: { nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  de: { nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  es: { nativeName: 'Español', flag: '🇪🇸', dir: 'ltr' },
};

function resolveSupportedLang(raw: string | null | undefined): SupportedLanguage {
  const base = (raw ?? '').split('-')[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedLanguage)
    : 'en';
}

export function getInitialLang(): SupportedLanguage {
  const stored = typeof localStorage !== 'undefined'
    ? localStorage.getItem('i18nextLng')
    : null;
  const navLang = typeof navigator !== 'undefined' ? navigator.language : '';
  return resolveSupportedLang(stored || navLang);
}

export function getInitialDirection(): 'ltr' | 'rtl' {
  return LANGUAGE_META[getInitialLang()].dir;
}

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    fallbackLng: 'en',
    load: 'languageOnly',
    keySeparator: false,
    nsSeparator: ':',
    interpolation: { escapeValue: false },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    ns: ['common', 'auth', 'dashboard', 'runner', 'results', 'settings', 'billing', 'landing'],
    defaultNS: 'common',
  });

export default i18n;

import i18next from 'i18next';
import FsBackend from 'i18next-fs-backend';
import path from 'path';

const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;

const i18n = i18next.createInstance();

i18n.use(FsBackend).init({
  supportedLngs: SUPPORTED_LANGUAGES,
  fallbackLng: 'en',
  preload: SUPPORTED_LANGUAGES as unknown as string[],
  ns: ['errors', 'success', 'emails', 'validation', 'billing'],
  defaultNS: 'errors',
  backend: {
    loadPath: path.join(__dirname, 'translations/{{lng}}/{{ns}}.json'),
  },
  interpolation: { escapeValue: false },
});

export default i18n;
export { SUPPORTED_LANGUAGES };

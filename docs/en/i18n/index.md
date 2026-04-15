# Internationalization (i18n)

WhyNot QA supports 5 languages: English, Arabic, French, German, and Spanish.

## Architecture

- **Library:** [react-i18next](https://react.i18next.com/) v15 + i18next v23
- **Backend:** `i18next-http-backend` loads translations from `/locales/{lang}/{namespace}.json`
- **Detection:** `i18next-browser-languagedetector` checks localStorage > browser > HTML lang attribute
- **RTL:** Arabic sets `dir="rtl"` on `<html>` via LanguageSwitcher
- **Fallback:** English (`en`) is the fallback language

## Locale Files

```
frontend/public/locales/
  en/    ar/    fr/    de/    es/
    common.json
    auth.json
    dashboard.json
    runner.json
    results.json
    settings.json
    billing.json
    landing.json

admin-frontend/public/locales/
  en/    ar/    fr/    de/    es/
    common.json
    admin.json
    auth.json
    settings.json
    superadmin.json
```

## Guides

- [How to Add a Translation Key](./how-to-add-a-translation-key.md)

## Testing

- `i18n-completeness.test.ts` validates key tree consistency across all languages
- `i18n-no-hardcoded-strings.test.ts` scans for untranslated English literals in page components
- `i18n.test.ts` validates i18n configuration (languages, RTL, metadata)

## Configuration

- Frontend: `frontend/src/i18n.ts`
- Admin: `admin-frontend/src/i18n.ts`
- Language switcher: `frontend/src/components/LanguageSwitcher.tsx`
